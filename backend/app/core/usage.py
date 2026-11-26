"""
Uso gratuito: registro de cada leitura e os limites que protegem o gasto com IA.

Regras (valores em limits(), editáveis no admin):
- Gasto do mês ≥ teto rígido: nenhuma leitura.
- Gasto do mês ≥ teto: só leituras em bar parceiro.
- Fora de bar parceiro: FREE_READS_PER_MONTH leituras com sucesso por aparelho.
  O IP tem um teto 10× maior: operadoras põem muitos clientes atrás do mesmo IP
  (CGNAT), então ele só barra abuso automatizado, não pessoas.
- Bar que passou do seu limite mensal: a leitura conta como fora de parceiro.
- Qualquer origem: IP_READS_PER_HOUR tentativas por IP por hora.

O "mês" é o do calendário no horário de Brasília (UTC−3, sem horário de verão).
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, Request

from app.core.auth import keyed_hash
from app.core.config import settings
from app.core.db import connect

BRT = timezone(timedelta(hours=-3))
IP_MONTHLY_FACTOR = 10

# chave na tabela settings -> (tipo, padrão vindo do .env)
LIMIT_FIELDS = {
    "monthly_budget_brl": (float, lambda: settings.MONTHLY_BUDGET_BRL),
    "hard_budget_brl": (float, lambda: settings.HARD_BUDGET_BRL),
    "free_reads_per_month": (int, lambda: settings.FREE_READS_PER_MONTH),
    "casa_reads_per_month": (int, lambda: settings.CASA_READS_PER_MONTH),
    "ip_reads_per_hour": (int, lambda: settings.IP_READS_PER_HOUR),
}

MSG_HARD = "O DivUp atingiu o limite de leituras deste mês. Tente de novo no próximo mês."
MSG_BUDGET = ("As leituras grátis deste mês acabaram. Nos bares com o QR do DivUp "
              "na mesa continua grátis.")
MSG_PERSONAL = ("Você usou {qtd} deste mês. Nos bares com o QR do "
                "DivUp na mesa é grátis — indique o seu.")
MSG_HOURLY = "Muitas leituras seguidas. Espere alguns minutos e tente de novo."


def _limit(reason: str, message: str) -> HTTPException:
    """429 com o motivo em X-Limit (personal, budget, hard, hourly): a PWA escolhe o título."""
    return HTTPException(status_code=429, detail=message, headers={"X-Limit": reason})


# ---------------------------------------------------------------------------
# Limites
# ---------------------------------------------------------------------------
def limits() -> dict:
    values = {key: default() for key, (_, default) in LIMIT_FIELDS.items()}
    with connect() as conn:
        rows = conn.execute("SELECT key, value FROM settings WHERE key IN (%s)" %
                            ",".join("?" * len(LIMIT_FIELDS)), tuple(LIMIT_FIELDS)).fetchall()
    for row in rows:
        cast = LIMIT_FIELDS[row["key"]][0]
        try:
            values[row["key"]] = cast(row["value"])
        except ValueError:
            pass
    return values


def save_limits(values: dict) -> dict:
    with connect() as conn:
        for key, value in values.items():
            if key in LIMIT_FIELDS:
                conn.execute(
                    "INSERT INTO settings (key, value) VALUES (?, ?) "
                    "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                    (key, str(value)),
                )
    return limits()


# ---------------------------------------------------------------------------
# Datas
# ---------------------------------------------------------------------------
def _utc(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def month_range(month: Optional[str] = None) -> tuple[str, str]:
    """Início e fim (UTC, ISO) de um mês 'AAAA-MM' no horário de Brasília; padrão: mês atual."""
    if month:
        year, mon = (int(p) for p in month.split("-"))
    else:
        now = datetime.now(BRT)
        year, mon = now.year, now.month
    start = datetime(year, mon, 1, tzinfo=BRT)
    end = datetime(year + (mon == 12), mon % 12 + 1, 1, tzinfo=BRT)
    return _utc(start), _utc(end)


def previous_month(month: str) -> str:
    year, mon = (int(p) for p in month.split("-"))
    return f"{year - (mon == 1)}-{(mon - 2) % 12 + 1:02d}"


def current_month() -> str:
    return datetime.now(BRT).strftime("%Y-%m")


# ---------------------------------------------------------------------------
# Quem está lendo
# ---------------------------------------------------------------------------
def client_ip(request: Request) -> str:
    # Atrás do Cloudflare Tunnel, request.client é o container do túnel
    return (request.headers.get("cf-connecting-ip")
            or (request.client.host if request.client else "")).strip()


def client_hashes(request: Request, device_id: Optional[str]) -> tuple[str, str]:
    device = (device_id or "").strip()[:64]
    return keyed_hash(device), keyed_hash(client_ip(request))


def find_casa(slug: Optional[str]) -> Optional[dict]:
    slug = (slug or "").strip().lower()[:64]
    if not slug:
        return None
    with connect() as conn:
        row = conn.execute("SELECT id, slug, name FROM casas WHERE slug = ? AND active = 1", (slug,)).fetchone()
    return dict(row) if row else None


# ---------------------------------------------------------------------------
# Verificação e registro
# ---------------------------------------------------------------------------
def month_spend(conn, start: str) -> float:
    return conn.execute("SELECT COALESCE(SUM(cost_brl), 0) FROM reads WHERE created_at >= ?", (start,)).fetchone()[0]


def check_allowed(casa: Optional[dict], device_hash: str, ip_hash: str) -> Optional[dict]:
    """
    Levanta HTTP 429 se a leitura não pode acontecer.
    Devolve a casa que vai receber a leitura (None se contar como fora de parceiro).
    """
    lim = limits()
    start, _ = month_range()
    hour_ago = _utc(datetime.now(timezone.utc) - timedelta(hours=1))

    with connect() as conn:
        if ip_hash:
            last_hour = conn.execute(
                "SELECT COUNT(*) FROM reads WHERE ip_hash = ? AND created_at >= ?", (ip_hash, hour_ago)
            ).fetchone()[0]
            if last_hour >= lim["ip_reads_per_hour"]:
                raise _limit("hourly", MSG_HOURLY)

        spent = month_spend(conn, start)
        if spent >= lim["hard_budget_brl"]:
            raise _limit("hard", MSG_HARD)

        if casa:
            casa_reads = conn.execute(
                "SELECT COUNT(*) FROM reads WHERE casa_id = ? AND success = 1 AND created_at >= ?",
                (casa["id"], start),
            ).fetchone()[0]
            if casa_reads < lim["casa_reads_per_month"]:
                return casa
            casa = None  # bar no limite: segue as regras de fora de parceiro

        if spent >= lim["monthly_budget_brl"]:
            raise _limit("budget", MSG_BUDGET)

        free = lim["free_reads_per_month"]
        personal_msg = MSG_PERSONAL.format(
            qtd="sua leitura grátis" if free == 1 else f"suas {free} leituras grátis")
        if device_hash:
            used = conn.execute(
                "SELECT COUNT(*) FROM reads WHERE device_hash = ? AND casa_id IS NULL "
                "AND success = 1 AND created_at >= ?", (device_hash, start),
            ).fetchone()[0]
            if used >= free:
                raise _limit("personal", personal_msg)
        if ip_hash:
            used_ip = conn.execute(
                "SELECT COUNT(*) FROM reads WHERE ip_hash = ? AND casa_id IS NULL "
                "AND success = 1 AND created_at >= ?", (ip_hash, start),
            ).fetchone()[0]
            # Sem identificador de aparelho (ex.: app Android antigo), o IP vale como pessoa
            ip_cap = free * IP_MONTHLY_FACTOR if device_hash else free
            if used_ip >= ip_cap:
                raise _limit("personal", personal_msg)
    return None


def record_read(*, casa: Optional[dict], device_hash: str, ip_hash: str, usage: Optional[dict],
                establishment_name: str, success: bool, ms: int) -> float:
    """Grava a leitura e devolve o gasto do mês até agora (R$)."""
    usage = usage or {}
    with connect() as conn:
        conn.execute(
            """INSERT INTO reads (casa_id, device_hash, ip_hash, establishment_name, model,
                                  tokens_in, tokens_out, cost_brl, success, ms)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (casa["id"] if casa else None, device_hash, ip_hash, (establishment_name or "")[:200],
             usage.get("model", ""), usage.get("tokens_in", 0), usage.get("tokens_out", 0),
             usage.get("cost_brl", 0.0), 1 if success else 0, ms),
        )
        return month_spend(conn, month_range()[0])


# ---------------------------------------------------------------------------
# Eventos do painel de uso
# ---------------------------------------------------------------------------
def record_event(name: str, device_hash: str = "", *, casa_id: Optional[int] = None,
                 standalone: bool = False, detail: str = "") -> None:
    with connect() as conn:
        conn.execute(
            "INSERT INTO events (name, device_hash, casa_id, standalone, detail) VALUES (?, ?, ?, ?, ?)",
            (name, device_hash, casa_id, 1 if standalone else 0, (detail or "")[:40]),
        )
