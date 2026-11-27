"""
Eventos anônimos do app para o painel de uso: abriu, enviou a parte, convite de instalar,
indicou o app a um amigo.

Sem login. O aparelho vira hash com segredo, como nas leituras. Um teto por IP
por hora evita que alguém encha a tabela.
"""
import time
from collections import defaultdict
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field

from app.core import usage

router = APIRouter()

EVENTS_PER_IP_HOUR = 300
_window: dict[str, list] = defaultdict(lambda: [0.0, 0])  # ip_hash -> [início da hora, contagem]


class Event(BaseModel):
    name: Literal["open", "share", "install", "invite"]
    device_id: Optional[str] = Field(default=None, max_length=64)
    casa: Optional[str] = Field(default=None, max_length=40)
    standalone: bool = False
    detail: str = Field(default="", max_length=40, pattern=r"^[a-z0-9_-]*$")


def _allowed(ip_hash: str) -> bool:
    now = time.time()
    slot = _window[ip_hash]
    if now - slot[0] > 3600:
        slot[0], slot[1] = now, 0
    slot[1] += 1
    if len(_window) > 50_000:  # memória: esquece janelas velhas
        for key in [k for k, v in _window.items() if now - v[0] > 3600]:
            _window.pop(key, None)
    return slot[1] <= EVENTS_PER_IP_HOUR


@router.post("", status_code=204)
def track(event: Event, request: Request):
    device_hash, ip_hash = usage.client_hashes(request, event.device_id)
    if not _allowed(ip_hash):
        raise HTTPException(status_code=429, detail="Muitos eventos.")
    casa = usage.find_casa(event.casa) if event.casa else None
    usage.record_event(event.name, device_hash, casa_id=casa["id"] if casa else None,
                       standalone=event.standalone, detail=event.detail)
    return Response(status_code=204)
