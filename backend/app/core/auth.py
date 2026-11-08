"""
Sessão por cookie assinado (HMAC-SHA256) e verificação do login do Google.

O cookie guarda só {uid, exp}; não há senha nem token do Google armazenado.
"""
import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Optional

from fastapi import HTTPException, Request

from app.core.config import settings
from app.core.db import connect

COOKIE_NAME = "divup_session"

if settings.SESSION_SECRET:
    _SECRET = settings.SESSION_SECRET.encode()
else:
    print("⚠️  SESSION_SECRET não configurado: usando segredo temporário (sessões caem a cada reinício)")
    _SECRET = secrets.token_bytes(32)


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def make_session(user_id: int) -> str:
    payload = _b64(json.dumps({"uid": user_id, "exp": int(time.time()) + settings.SESSION_DAYS * 86400}).encode())
    sig = _b64(hmac.new(_SECRET, payload.encode(), hashlib.sha256).digest())
    return f"{payload}.{sig}"


def read_session(token: str) -> Optional[int]:
    try:
        payload, sig = token.split(".", 1)
        expected = _b64(hmac.new(_SECRET, payload.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, expected):
            return None
        data = json.loads(_unb64(payload))
        if data.get("exp", 0) < time.time():
            return None
        return int(data["uid"])
    except Exception:
        return None


def set_session_cookie(response, user_id: int) -> None:
    response.set_cookie(
        COOKIE_NAME,
        make_session(user_id),
        max_age=settings.SESSION_DAYS * 86400,
        httponly=True,
        secure=True,       # navegadores aceitam Secure em localhost
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/", secure=True, httponly=True, samesite="lax")


def current_user_optional(request: Request) -> Optional[dict]:
    token = request.cookies.get(COOKIE_NAME)
    uid = read_session(token) if token else None
    if uid is None:
        return None
    with connect() as conn:
        row = conn.execute("SELECT id, email, name, picture FROM users WHERE id = ?", (uid,)).fetchone()
    return dict(row) if row else None


def current_user(request: Request) -> dict:
    user = current_user_optional(request)
    if not user:
        raise HTTPException(status_code=401, detail="Entre com sua conta Google para continuar.")
    return user


def verify_google_credential(credential: str) -> dict:
    """Valida o ID token do botão 'Entrar com Google' (assinatura, emissor, validade, aud)."""
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests

    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Login com Google ainda não configurado.")
    try:
        info = id_token.verify_oauth2_token(credential, google_requests.Request(), settings.GOOGLE_CLIENT_ID)
    except ValueError:
        raise HTTPException(status_code=401, detail="Não foi possível confirmar o login com o Google.")
    if not info.get("email_verified", False):
        raise HTTPException(status_code=401, detail="O e-mail da conta Google não está verificado.")
    return info
