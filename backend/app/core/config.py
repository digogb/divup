from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    PROJECT_NAME: str = "DivUp API"
    API_V1_PREFIX: str = "/api/v1"
    UPLOAD_DIR: str = "/app/uploads"
    ALLOWED_EXTENSIONS: str = ".jpg,.jpeg,.png"

    # Google Cloud Vision (legado)
    GOOGLE_APPLICATION_CREDENTIALS: str = "/app/credentials.json"

    # Login com Google (ID do cliente OAuth — público, aparece no site)
    GOOGLE_CLIENT_ID: str = ""
    # Assina o cookie de sessão. Sem ele, um segredo aleatório é gerado a cada
    # reinício (todos são deslogados).
    SESSION_SECRET: str = ""
    SESSION_DAYS: int = 90

    # Banco SQLite do histórico
    DATA_DIR: str = "/app/data"

    # Origens que podem chamar a API com cookies
    ALLOWED_ORIGINS: str = "https://divup.rglabs.tech,http://localhost:8001,http://127.0.0.1:8001"


settings = Settings()
