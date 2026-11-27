"""
Área de admin: números do mês, bares parceiros (com QR Code), bares para visitar e limites.

Tudo exige login Google com um e-mail de ADMIN_EMAILS.
"""
import io
import re
import unicodedata
from datetime import datetime
from typing import Optional

import qrcode
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from PIL import Image, ImageDraw, ImageFont
from pydantic import BaseModel, Field, model_validator

from app.core import usage
from app.core.auth import current_admin
from app.core.config import settings
from app.core.db import connect

router = APIRouter(dependencies=[Depends(current_admin)])

MONTH = Query(None, pattern=r"^\d{4}-(0[1-9]|1[0-2])$", description="AAAA-MM; padrão: mês atual")
SLUG_RE = r"^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$"
UNKNOWN_PLACE = "Estabelecimento Desconhecido"


def _month(mes: Optional[str]) -> tuple[str, str, str]:
    mes = mes or usage.current_month()
    start, end = usage.month_range(mes)
    return mes, start, end


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")[:40].strip("-") or "bar"


def casa_url(slug: str) -> str:
    return f"{settings.PUBLIC_URL.rstrip('/')}/?casa={slug}"


# ---------------------------------------------------------------------------
# Resumo do mês
# ---------------------------------------------------------------------------
@router.get("/summary")
def summary(mes: Optional[str] = MONTH):
    mes, start, end = _month(mes)
    prev_start, prev_end = usage.month_range(usage.previous_month(mes))
    lim = usage.limits()
    with connect() as conn:
        row = conn.execute(
            """SELECT COUNT(*) AS attempts,
                      COALESCE(SUM(success), 0) AS ok,
                      COALESCE(SUM(CASE WHEN success = 1 AND casa_id IS NOT NULL THEN 1 ELSE 0 END), 0) AS partner,
                      COALESCE(SUM(cost_brl), 0) AS spent,
                      COUNT(DISTINCT CASE WHEN success = 1 AND device_hash != '' THEN device_hash END) AS devices
               FROM reads WHERE created_at >= ? AND created_at < ?""",
            (start, end),
        ).fetchone()
        returning = conn.execute(
            """SELECT COUNT(DISTINCT device_hash) FROM reads
               WHERE success = 1 AND device_hash != '' AND created_at >= ? AND created_at < ?
                 AND device_hash IN (SELECT device_hash FROM reads
                                     WHERE success = 1 AND device_hash != '' AND created_at >= ? AND created_at < ?)""",
            (start, end, prev_start, prev_end),
        ).fetchone()[0]
        prev_devices = conn.execute(
            """SELECT COUNT(DISTINCT device_hash) FROM reads
               WHERE success = 1 AND device_hash != '' AND created_at >= ? AND created_at < ?""",
            (prev_start, prev_end),
        ).fetchone()[0]

    spent = row["spent"]
    # Projeção para o mês atual: ritmo até agora × dias do mês
    projected = None
    if mes == usage.current_month():
        now = datetime.now(usage.BRT)
        first = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        nxt = first.replace(year=first.year + (first.month == 12), month=first.month % 12 + 1)
        elapsed = (now - first).total_seconds() / (nxt - first).total_seconds()
        projected = round(spent / elapsed, 2) if elapsed > 0.02 else None

    return {
        "month": mes,
        "spent_brl": round(spent, 2),
        "projected_brl": projected,
        "budget_brl": lim["monthly_budget_brl"],
        "hard_budget_brl": lim["hard_budget_brl"],
        "reads_ok": row["ok"],
        "reads_partner": row["partner"],
        "reads_outside": row["ok"] - row["partner"],
        "reads_failed": row["attempts"] - row["ok"],
        "avg_cost_brl": round(spent / row["attempts"], 4) if row["attempts"] else 0,
        "devices": row["devices"],
        "devices_prev_month": prev_devices,
        "devices_returning": returning,
    }


# ---------------------------------------------------------------------------
# Painel de uso: dia a dia, funil, qualidade da leitura, instalação
# ---------------------------------------------------------------------------
GATE_ACTIVE = 2000      # Portão 1 do plano de negócio: aparelhos ativos no mês
GATE_RETURN_PCT = 30    # e % que voltam no mês seguinte
DAY_BRT = "date(created_at, '-3 hours')"  # created_at é UTC; o dia conta em Brasília


def _days(mes: str) -> list[str]:
    """Dias do mês (AAAA-MM-DD) até hoje, se for o mês atual."""
    year, mon = map(int, mes.split("-"))
    first = datetime(year, mon, 1)
    nxt = datetime(year + (mon == 12), mon % 12 + 1, 1)
    last = (nxt - first).days
    if mes == usage.current_month():
        last = datetime.now(usage.BRT).day
    return [f"{mes}-{d:02d}" for d in range(1, last + 1)]


def _distinct(conn, sql: str, args: tuple) -> int:
    return conn.execute(f"SELECT COUNT(DISTINCT device_hash) FROM ({sql}) WHERE device_hash != ''", args).fetchone()[0]


@router.get("/usage")
def usage_panel(mes: Optional[str] = MONTH):
    mes, start, end = _month(mes)
    rng = (start, end)
    with connect() as conn:
        # Dia a dia
        daily = {d: {"day": d, "opens": 0, "reads_ok": 0, "reads_failed": 0, "blocked": 0, "devices": 0} for d in _days(mes)}
        for r in conn.execute(
            f"""SELECT {DAY_BRT} AS d, COUNT(DISTINCT CASE WHEN device_hash != '' THEN device_hash END) AS n
                FROM events WHERE name = 'open' AND created_at >= ? AND created_at < ? GROUP BY d""", rng):
            if r["d"] in daily: daily[r["d"]]["opens"] = r["n"]
        for r in conn.execute(
            f"""SELECT {DAY_BRT} AS d, SUM(success) AS ok, COUNT(*) - SUM(success) AS failed,
                       COUNT(DISTINCT CASE WHEN success = 1 AND device_hash != '' THEN device_hash END) AS devices
                FROM reads WHERE created_at >= ? AND created_at < ? GROUP BY d""", rng):
            if r["d"] in daily: daily[r["d"]].update(reads_ok=r["ok"], reads_failed=r["failed"], devices=r["devices"])
        for r in conn.execute(
            f"""SELECT {DAY_BRT} AS d, COUNT(*) AS n FROM events
                WHERE name = 'blocked' AND created_at >= ? AND created_at < ? GROUP BY d""", rng):
            if r["d"] in daily: daily[r["d"]]["blocked"] = r["n"]

        # Funil do mês, em aparelhos
        ev = "SELECT device_hash FROM events WHERE name = ? AND created_at >= ? AND created_at < ?"
        funnel = {
            "opened": _distinct(conn, ev, ("open", *rng)),
            "tried": _distinct(conn, f"""SELECT device_hash FROM reads WHERE created_at >= ? AND created_at < ?
                                         UNION ALL {ev}""", (*rng, "blocked", *rng)),
            "read_ok": _distinct(conn, "SELECT device_hash FROM reads WHERE success = 1 AND created_at >= ? AND created_at < ?", rng),
            "shared": _distinct(conn, ev, ("share", *rng)),
        }

        # Qualidade da leitura
        times = sorted(r[0] for r in conn.execute(
            "SELECT ms FROM reads WHERE success = 1 AND ms > 0 AND created_at >= ? AND created_at < ?", rng))
        attempts, ok = conn.execute(
            "SELECT COUNT(*), COALESCE(SUM(success), 0) FROM reads WHERE created_at >= ? AND created_at < ?", rng).fetchone()

        def pct(p):
            return round(times[min(len(times) - 1, int(p * len(times)))] / 1000, 1) if times else None

        # Quantas leituras cada aparelho fez no mês (sinal de quem pagaria por mais)
        per_device = [r[0] for r in conn.execute(
            """SELECT COUNT(*) FROM reads WHERE success = 1 AND device_hash != '' AND created_at >= ? AND created_at < ?
               GROUP BY device_hash""", rng)]
        buckets = [("1", 1, 1), ("2", 2, 2), ("3", 3, 3), ("4–10", 4, 10), ("11+", 11, 10**9)]
        distribution = [{"label": b, "devices": sum(lo <= n <= hi for n in per_device)} for b, lo, hi in buckets]

        blocked = {r["detail"] or "?": r["n"] for r in conn.execute(
            """SELECT detail, COUNT(*) AS n FROM events WHERE name = 'blocked' AND created_at >= ? AND created_at < ?
               GROUP BY detail""", rng)}
        shares = {r["detail"] or "?": r["n"] for r in conn.execute(
            """SELECT detail, COUNT(*) AS n FROM events WHERE name = 'share' AND created_at >= ? AND created_at < ?
               GROUP BY detail""", rng)}
        install = {r["detail"] or "?": r["n"] for r in conn.execute(
            """SELECT detail, COUNT(DISTINCT device_hash) AS n FROM events
               WHERE name = 'install' AND created_at >= ? AND created_at < ? GROUP BY detail""", rng)}
        # Quem tocou em "Indicar a um amigo" e mandou o link
        invited = _distinct(conn, ev, ("invite", *rng))
        # Conta de exemplo: quantos abriram e quantos marcaram algum item
        dv = "SELECT device_hash FROM events WHERE name = 'demo' AND detail = ? AND created_at >= ? AND created_at < ?"
        demo = {"started": _distinct(conn, dv, ("start", *rng)), "done": _distinct(conn, dv, ("done", *rng))}
        # De onde vieram (utm_source, ref ou anúncio da Meta), em aparelhos
        sources = {r["detail"]: r["n"] for r in conn.execute(
            """SELECT detail, COUNT(DISTINCT device_hash) AS n FROM events
               WHERE name = 'open' AND detail != '' AND device_hash != '' AND created_at >= ? AND created_at < ?
               GROUP BY detail ORDER BY n DESC""", rng)}
        origin = conn.execute(
            """SELECT COUNT(DISTINCT CASE WHEN casa_id IS NOT NULL THEN device_hash END) AS qr,
                      COUNT(DISTINCT CASE WHEN standalone = 1 THEN device_hash END) AS installed
               FROM events WHERE name = 'open' AND device_hash != '' AND created_at >= ? AND created_at < ?""", rng).fetchone()
        accounts = conn.execute(
            """SELECT (SELECT COUNT(*) FROM users WHERE created_at >= ? AND created_at < ?) AS new_users,
                      (SELECT COUNT(*) FROM users) AS users,
                      (SELECT COUNT(*) FROM receipts WHERE created_at >= ? AND created_at < ?) AS saved,
                      (SELECT COUNT(DISTINCT user_id) FROM receipts WHERE created_at >= ? AND created_at < ?) AS savers""",
            (*rng, *rng, *rng)).fetchone()

    return {
        "month": mes,
        "gate": {"active_target": GATE_ACTIVE, "return_target_pct": GATE_RETURN_PCT},
        "daily": list(daily.values()),
        "funnel": funnel,
        "quality": {
            "attempts": attempts, "ok": ok,
            "success_pct": round(100 * ok / attempts) if attempts else None,
            "p50_s": pct(0.5), "p90_s": pct(0.9),
        },
        "distribution": distribution,
        "over_3": sum(n > 3 for n in per_device),
        "blocked": blocked,
        "shares": shares,
        "install": install,
        "opened_from_qr": origin["qr"],
        "sources": sources,
        "invited": invited,
        "demo": demo,
        "opened_installed": origin["installed"],
        "accounts": dict(accounts),
    }


# ---------------------------------------------------------------------------
# Bares parceiros
# ---------------------------------------------------------------------------
class NewCasa(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    slug: Optional[str] = Field(default=None, pattern=SLUG_RE)


class CasaPatch(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=80)
    active: Optional[bool] = None


def _casa_rows(conn, start: str, end: str, slug: Optional[str] = None) -> list[dict]:
    rows = conn.execute(
        f"""SELECT c.slug, c.name, c.active, c.created_at,
                   COUNT(r.id) AS reads,
                   COUNT(DISTINCT CASE WHEN r.device_hash != '' THEN r.device_hash END) AS devices,
                   COALESCE(SUM(r.cost_brl), 0) AS cost_brl
            FROM casas c
            LEFT JOIN reads r ON r.casa_id = c.id AND r.success = 1 AND r.created_at >= ? AND r.created_at < ?
            {'WHERE c.slug = ?' if slug else ''}
            GROUP BY c.id
            ORDER BY c.active DESC, reads DESC, c.name""",
        (start, end, slug) if slug else (start, end),
    ).fetchall()
    return [
        {**dict(r), "active": bool(r["active"]), "cost_brl": round(r["cost_brl"], 2), "url": casa_url(r["slug"])}
        for r in rows
    ]


@router.get("/casas")
def list_casas(mes: Optional[str] = MONTH):
    mes, start, end = _month(mes)
    with connect() as conn:
        return {"month": mes, "casas": _casa_rows(conn, start, end)}


@router.post("/casas", status_code=201)
def create_casa(body: NewCasa):
    name = body.name.strip()
    base = body.slug or slugify(name)
    with connect() as conn:
        taken = {r[0] for r in conn.execute("SELECT slug FROM casas WHERE slug = ? OR slug LIKE ?", (base, f"{base}-%"))}
        if body.slug and base in taken:
            raise HTTPException(status_code=409, detail="Já existe um bar com esse código.")
        slug, n = base, 2
        while slug in taken:
            slug, n = f"{base}-{n}", n + 1
        conn.execute("INSERT INTO casas (slug, name) VALUES (?, ?)", (slug, name))
        start, end = usage.month_range()
        return _casa_rows(conn, start, end, slug)[0]


@router.patch("/casas/{slug}")
def update_casa(slug: str, body: CasaPatch):
    with connect() as conn:
        if not conn.execute("SELECT 1 FROM casas WHERE slug = ?", (slug,)).fetchone():
            raise HTTPException(status_code=404, detail="Bar não encontrado.")
        if body.name is not None:
            conn.execute("UPDATE casas SET name = ? WHERE slug = ?", (body.name.strip(), slug))
        if body.active is not None:
            conn.execute("UPDATE casas SET active = ? WHERE slug = ?", (1 if body.active else 0, slug))
        start, end = usage.month_range()
        return _casa_rows(conn, start, end, slug)[0]


# DejaVu (pacote fonts-dejavu-core no Dockerfile): a fonte embutida do Pillow não tem acentos
FONT_REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def _font(size: int, bold: bool = False):
    try:
        return ImageFont.truetype(FONT_BOLD if bold else FONT_REGULAR, size)
    except OSError:
        print("⚠️  Fonte DejaVu ausente: o cartão do QR sai sem acentos")
        return ImageFont.load_default(size=size)


def qr_card_png(name: str, url: str) -> bytes:
    """Cartão para a mesa: chamada, QR Code e nome do bar, em PNG para imprimir."""
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=16, border=2)
    qr.add_data(url)
    qr.make(fit=True)
    code = qr.make_image(fill_color="black", back_color="white").convert("RGB")

    width = max(code.width + 120, 900)
    card = Image.new("RGB", (width, code.height + 420), "white")
    draw = ImageDraw.Draw(card)
    title, sub = _font(56, bold=True), _font(32)
    draw.text((width // 2, 70), "Divida a conta", font=title, fill="#15171C", anchor="mm")
    draw.text((width // 2, 140), "Aponte a câmera e marque o que você consumiu", font=sub, fill="#5A5F69", anchor="mm")
    card.paste(code, ((width - code.width) // 2, 190))
    y = 190 + code.height + 60
    size = 48
    while size > 22 and draw.textlength(name, font=_font(size, bold=True)) > width - 80:
        size -= 2  # nome longo: diminui até caber na largura do cartão
    draw.text((width // 2, y), name, font=_font(size, bold=True), fill="#0A7C5A", anchor="mm")
    draw.text((width // 2, y + 70), "divup · grátis nesta mesa", font=sub, fill="#5A5F69", anchor="mm")
    out = io.BytesIO()
    card.save(out, format="PNG", optimize=True)
    return out.getvalue()


@router.get("/casas/{slug}/qr.png")
def casa_qr(slug: str):
    with connect() as conn:
        row = conn.execute("SELECT slug, name FROM casas WHERE slug = ?", (slug,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Bar não encontrado.")
    return Response(
        qr_card_png(row["name"], casa_url(row["slug"])),
        media_type="image/png",
        headers={"Content-Disposition": f'inline; filename="divup-{row["slug"]}.png"'},
    )


# ---------------------------------------------------------------------------
# Bares para visitar: lidos fora de parceiros
# ---------------------------------------------------------------------------
@router.get("/leads")
def leads(mes: Optional[str] = MONTH):
    mes, start, end = _month(mes)
    with connect() as conn:
        rows = conn.execute(
            """SELECT MIN(r.establishment_name) AS name, COUNT(*) AS reads,
                      COUNT(DISTINCT CASE WHEN r.device_hash != '' THEN r.device_hash END) AS devices,
                      MAX(r.created_at) AS last_read
               FROM reads r
               WHERE r.casa_id IS NULL AND r.success = 1 AND r.created_at >= ? AND r.created_at < ?
                 AND TRIM(r.establishment_name) NOT IN ('', ?)
                 AND LOWER(TRIM(r.establishment_name)) NOT IN (SELECT LOWER(TRIM(name)) FROM casas)
               GROUP BY LOWER(TRIM(r.establishment_name))
               ORDER BY reads DESC, last_read DESC
               LIMIT 50""",
            (start, end, UNKNOWN_PLACE),
        ).fetchall()
    return {"month": mes, "leads": [dict(r) for r in rows]}


# ---------------------------------------------------------------------------
# Limites
# ---------------------------------------------------------------------------
class Limits(BaseModel):
    monthly_budget_brl: float = Field(gt=0, le=100_000)
    hard_budget_brl: float = Field(gt=0, le=100_000)
    free_reads_per_month: int = Field(ge=0, le=1000)
    casa_reads_per_month: int = Field(ge=0, le=1_000_000)
    ip_reads_per_hour: int = Field(ge=1, le=10_000)

    @model_validator(mode="after")
    def hard_above_budget(self):
        if self.hard_budget_brl < self.monthly_budget_brl:
            raise ValueError("O teto rígido precisa ser maior ou igual ao teto.")
        return self


@router.get("/limits")
def get_limits():
    return usage.limits()


@router.put("/limits")
def put_limits(body: Limits):
    return usage.save_limits(body.model_dump())
