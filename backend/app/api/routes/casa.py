"""Bar parceiro: a PWA confirma o código do QR Code da mesa e mostra o nome."""
from fastapi import APIRouter, HTTPException

from app.core.usage import find_casa

router = APIRouter()


@router.get("/{slug}")
def get_casa(slug: str):
    casa = find_casa(slug)
    if not casa:
        raise HTTPException(status_code=404, detail="Bar não encontrado.")
    return {"slug": casa["slug"], "name": casa["name"]}
