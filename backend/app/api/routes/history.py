"""
Histórico pessoal de contas.

Guarda o estado da divisão (itens, o que é "meu", divisões, serviço) para
reabrir e reenviar depois. Nunca guarda a foto da nota.
"""
import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.core.auth import current_user
from app.core.db import connect

router = APIRouter()

MAX_PAYLOAD_BYTES = 64 * 1024
MAX_RECEIPTS_LISTED = 500


class SavedItem(BaseModel):
    id: str = Field(max_length=64)
    name: str = Field(max_length=200)
    quantity: int = Field(ge=1, le=999)
    unitPrice: float = Field(ge=0, le=1_000_000)
    listUnitPrice: float = Field(default=0, ge=0, le=1_000_000)
    discount: float = Field(default=0, ge=0, le=1_000_000)
    sel: int = Field(ge=0, le=999)
    split: int = Field(ge=1, le=99)


class SavedTip(BaseModel):
    mode: str = Field(pattern="^(preset|custom)$")
    preset: float = Field(ge=0, le=100)
    custom: str = Field(default="", max_length=8)


class SaveReceipt(BaseModel):
    id: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_.:-]+$")
    title: str = Field(max_length=200)
    date: str = Field(default="", max_length=20)
    subtotal: float = Field(default=0, ge=0)
    total: float = Field(default=0, ge=0)
    discount: float = Field(default=0, ge=0)
    items: List[SavedItem] = Field(max_length=300)
    tip: SavedTip
    my_total: float = Field(ge=0, le=10_000_000)

    @field_validator("title")
    @classmethod
    def strip_title(cls, v: str) -> str:
        return v.strip() or "Sua conta"


def _summary(row) -> dict:
    return {
        "id": row["id"],
        "title": row["title"],
        "date": row["receipt_date"],
        "my_total": row["my_total"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


@router.get("")
def list_receipts(user: dict = Depends(current_user)):
    with connect() as conn:
        rows = conn.execute(
            """SELECT id, title, receipt_date, my_total, created_at, updated_at
               FROM receipts WHERE user_id = ? ORDER BY created_at DESC LIMIT ?""",
            (user["id"], MAX_RECEIPTS_LISTED),
        ).fetchall()
    return {"receipts": [_summary(r) for r in rows]}


@router.get("/{receipt_id}")
def get_receipt(receipt_id: str, user: dict = Depends(current_user)):
    with connect() as conn:
        row = conn.execute(
            "SELECT * FROM receipts WHERE user_id = ? AND id = ?", (user["id"], receipt_id)
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Conta não encontrada no histórico.")
    return {**_summary(row), "payload": json.loads(row["payload"])}


@router.put("/{receipt_id}")
def save_receipt(receipt_id: str, body: SaveReceipt, user: dict = Depends(current_user)):
    """Cria ou atualiza (idempotente: o app pode salvar várias vezes a mesma conta)."""
    if body.id != receipt_id:
        raise HTTPException(status_code=400, detail="ID inconsistente.")
    payload = body.model_dump(exclude={"my_total"})
    payload_json = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    if len(payload_json.encode()) > MAX_PAYLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Conta grande demais para salvar.")
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO receipts (id, user_id, title, receipt_date, my_total, payload)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, id) DO UPDATE SET
                title = excluded.title, receipt_date = excluded.receipt_date,
                my_total = excluded.my_total, payload = excluded.payload,
                updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
            """,
            (receipt_id, user["id"], body.title, body.date, round(body.my_total, 2), payload_json),
        )
    return {"ok": True}


@router.delete("/{receipt_id}")
def delete_receipt(receipt_id: str, user: dict = Depends(current_user)):
    with connect() as conn:
        conn.execute("DELETE FROM receipts WHERE user_id = ? AND id = ?", (user["id"], receipt_id))
    return {"ok": True}
