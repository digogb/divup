"""
Banco SQLite do histórico (um arquivo em DATA_DIR).

Simples de propósito: um único servidor, volume pequeno, sem dependências.
WAL permite leituras enquanto há uma escrita.
"""
import os
import sqlite3
from contextlib import contextmanager

from app.core.config import settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    google_sub  TEXT NOT NULL UNIQUE,
    email       TEXT NOT NULL,
    name        TEXT NOT NULL DEFAULT '',
    picture     TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    last_login  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS receipts (
    id          TEXT NOT NULL,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    receipt_date TEXT NOT NULL DEFAULT '',
    my_total    REAL NOT NULL DEFAULT 0,
    payload     TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    PRIMARY KEY (user_id, id)
);

CREATE INDEX IF NOT EXISTS idx_receipts_user_created ON receipts(user_id, created_at DESC);

-- Bares parceiros (QR Code na mesa com ?casa=<slug>)
CREATE TABLE IF NOT EXISTS casas (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    slug        TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Uma linha por leitura de nota (com ou sem sucesso): custo, limites e métricas.
-- Aparelho e IP só como hash com segredo; o valor original nunca é gravado.
CREATE TABLE IF NOT EXISTS reads (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    casa_id            INTEGER REFERENCES casas(id),
    device_hash        TEXT NOT NULL DEFAULT '',
    ip_hash            TEXT NOT NULL DEFAULT '',
    establishment_name TEXT NOT NULL DEFAULT '',
    model              TEXT NOT NULL DEFAULT '',
    tokens_in          INTEGER NOT NULL DEFAULT 0,
    tokens_out         INTEGER NOT NULL DEFAULT 0,
    cost_brl           REAL NOT NULL DEFAULT 0,
    success            INTEGER NOT NULL DEFAULT 0,
    ms                 INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_reads_created ON reads(created_at);
CREATE INDEX IF NOT EXISTS idx_reads_casa ON reads(casa_id, created_at);
CREATE INDEX IF NOT EXISTS idx_reads_device ON reads(device_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_reads_ip ON reads(ip_hash, created_at);

-- Configurações editáveis no admin (ex.: limites)
-- Eventos anônimos do app para o painel de uso (abriu, enviou a parte, instalou, foi barrado).
-- Mesmo hash de aparelho da tabela reads; nada que identifique a pessoa.
CREATE TABLE IF NOT EXISTS events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    name        TEXT NOT NULL,
    device_hash TEXT NOT NULL DEFAULT '',
    casa_id     INTEGER REFERENCES casas(id),
    standalone  INTEGER NOT NULL DEFAULT 0,
    detail      TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_events_name_created ON events(name, created_at);

CREATE TABLE IF NOT EXISTS settings (
    key    TEXT PRIMARY KEY,
    value  TEXT NOT NULL
);
"""


def db_path() -> str:
    return os.path.join(settings.DATA_DIR, "divup.db")


def init_db() -> None:
    os.makedirs(settings.DATA_DIR, exist_ok=True)
    with connect() as conn:
        conn.executescript(SCHEMA)


@contextmanager
def connect():
    conn = sqlite3.connect(db_path(), timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
