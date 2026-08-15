"""
Central configuration for the TobaccoShield backend (Member D).
Reads from environment variables / .env file.
"""
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "sqlite:///./tobaccoshield.db"

    SECRET_KEY: str = "dev-only-insecure-secret-change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    UPLOAD_DIR: str = "./uploads"

    USE_REAL_QUALITY_MODULE: bool = True
    USE_REAL_RISK_MODULE: bool = True

    @property
    def upload_path(self) -> Path:
        p = Path(self.UPLOAD_DIR)
        (p / "images").mkdir(parents=True, exist_ok=True)
        (p / "heatmaps").mkdir(parents=True, exist_ok=True)
        return p


settings = Settings()
