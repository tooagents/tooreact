from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "TooAcc API"
    app_env: str = "dev"
    api_v1_prefix: str = "/api/v1"
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/postgres"
    supabase_jwt_issuer: str = ""
    supabase_jwt_audience: str = "authenticated"
    openai_model_default: str = "gpt-5.4-mini"
    openai_enabled: bool = True
    openai_timeout_sec: float = 12.0
    default_currency: str = "CAD"
    default_tax_jurisdiction: str = "CA"
    main_color: str = "#F28500"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()
