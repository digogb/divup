from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.api.routes import api_router
from app.core.config import settings
from app.core.db import init_db
import os

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="API para processamento de notas fiscais com OCR",
    version="1.0.0"
)

# CORS: com login por cookie, só o próprio app pode chamar a API com credenciais.
# (O app Android não é navegador e não é afetado por CORS.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type"],
)


@app.on_event("startup")
def startup():
    init_db()

@app.middleware("http")
async def cache_headers(request, call_next):
    """
    Controla cache da PWA (inclusive no Cloudflare, que sem isso guarda .js por 4h):
    - HTML, JS, CSS, service worker e manifest: sempre revalidar (ETag torna barato).
    - Ícones: podem ficar em cache por 7 dias.
    - API: nunca em cache.
    """
    response = await call_next(request)
    path = request.url.path
    if path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    elif path.startswith("/assets/"):
        response.headers["Cache-Control"] = "public, max-age=604800"
    elif path in ("/", "/index.html", "/sw.js", "/manifest.json", "/privacidade", "/termos") or path.startswith(("/js/", "/css/")):
        response.headers["Cache-Control"] = "no-cache"
    return response

# Rotas da API
app.include_router(api_router, prefix=settings.API_V1_PREFIX)

# Caminho para a pasta PWA
PWA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "pwa")

# Servir arquivos estáticos da PWA (CSS, JS, assets)
if os.path.exists(PWA_DIR):
    app.mount("/css", StaticFiles(directory=os.path.join(PWA_DIR, "css")), name="css")
    app.mount("/js", StaticFiles(directory=os.path.join(PWA_DIR, "js")), name="js")
    app.mount("/assets", StaticFiles(directory=os.path.join(PWA_DIR, "assets")), name="assets")

@app.get("/")
async def root():
    """Serve a PWA ou mensagem de boas-vindas"""
    index_path = os.path.join(PWA_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path, media_type="text/html")
    return {"message": "DivUp API - Use /docs para documentação"}

@app.get("/index.html")
async def index_html():
    """Rota alternativa para index.html (compatibilidade com Service Worker)"""
    index_path = os.path.join(PWA_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path, media_type="text/html")
    return {"error": "index.html not found"}

@app.get("/privacidade")
async def privacy_policy():
    """Política de Privacidade (link exigido pelo Google para o login)."""
    return FileResponse(os.path.join(PWA_DIR, "privacidade.html"), media_type="text/html")

@app.get("/termos")
async def terms_of_use():
    return FileResponse(os.path.join(PWA_DIR, "termos.html"), media_type="text/html")

@app.get("/manifest.json")
async def manifest():
    """Serve o manifest da PWA"""
    manifest_path = os.path.join(PWA_DIR, "manifest.json")
    if os.path.exists(manifest_path):
        return FileResponse(manifest_path, media_type="application/json")
    return {"error": "Manifest not found"}

@app.get("/sw.js")
async def service_worker():
    """Serve o Service Worker da PWA"""
    sw_path = os.path.join(PWA_DIR, "sw.js")
    if os.path.exists(sw_path):
        return FileResponse(sw_path, media_type="application/javascript")
    return {"error": "Service Worker not found"}

