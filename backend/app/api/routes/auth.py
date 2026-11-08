from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, Field

from app.core import auth
from app.core.config import settings
from app.core.db import connect

router = APIRouter()


class GoogleLogin(BaseModel):
    credential: str = Field(min_length=20, max_length=8192)


class DeleteAccount(BaseModel):
    confirm: bool


def _public(user: dict) -> dict:
    return {"email": user["email"], "name": user["name"], "picture": user["picture"]}


@router.get("/config")
def auth_config():
    """O ID do cliente OAuth é público: o botão do Google precisa dele no navegador."""
    return {"google_client_id": settings.GOOGLE_CLIENT_ID}


@router.post("/google")
def login_google(body: GoogleLogin, response: Response):
    info = auth.verify_google_credential(body.credential)
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO users (google_sub, email, name, picture) VALUES (?, ?, ?, ?)
            ON CONFLICT(google_sub) DO UPDATE SET
                email = excluded.email, name = excluded.name, picture = excluded.picture,
                last_login = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
            """,
            (info["sub"], info.get("email", ""), info.get("name", ""), info.get("picture", "")),
        )
        user = dict(conn.execute(
            "SELECT id, email, name, picture FROM users WHERE google_sub = ?", (info["sub"],)
        ).fetchone())
    auth.set_session_cookie(response, user["id"])
    return {"user": _public(user)}


@router.get("/me")
def me(request: Request):
    user = auth.current_user_optional(request)
    return {"user": _public(user) if user else None}


@router.post("/logout")
def logout(response: Response):
    auth.clear_session_cookie(response)
    return {"ok": True}


@router.delete("/me")
def delete_account(body: DeleteAccount, response: Response, user: dict = Depends(auth.current_user)):
    """Exclui a conta e todo o histórico (LGPD)."""
    if not body.confirm:
        return {"ok": False}
    with connect() as conn:
        conn.execute("DELETE FROM receipts WHERE user_id = ?", (user["id"],))
        conn.execute("DELETE FROM users WHERE id = ?", (user["id"],))
    auth.clear_session_cookie(response)
    return {"ok": True}
