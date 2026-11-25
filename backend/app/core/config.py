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

    # Leitura das notas (Gemini). gemini-2.5-flash é desligado em 2026-12-01.
    GEMINI_MODEL: str = "gemini-3.5-flash-lite"
    # Preço do modelo (US$ por milhão de tokens) e câmbio, para estimar o custo de cada leitura
    PRICE_IN_USD_PER_M: float = 0.30
    PRICE_OUT_USD_PER_M: float = 2.50
    USD_BRL: float = 5.50

    # Limites do uso gratuito (padrões; o admin pode mudar sem novo deploy)
    MONTHLY_BUDGET_BRL: float = 100.0   # atingido: só leituras em bares parceiros
    HARD_BUDGET_BRL: float = 150.0      # atingido: nenhuma leitura
    FREE_READS_PER_MONTH: int = 3       # por aparelho, fora de bar parceiro
    CASA_READS_PER_MONTH: int = 1500    # por bar parceiro
    IP_READS_PER_HOUR: int = 20         # anti-abuso, qualquer origem

    # E-mails (separados por vírgula) com acesso à área de admin
    ADMIN_EMAILS: str = ""

    # Banco SQLite do histórico
    DATA_DIR: str = "/app/data"

    # Origens que podem chamar a API com cookies
    ALLOWED_ORIGINS: str = "https://divup.rglabs.tech,http://localhost:8001,http://127.0.0.1:8001"


settings = Settings()
