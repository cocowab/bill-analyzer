from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./bill_analyzer.db"
    CORS_ORIGINS: str = "http://localhost:5173"
    UPLOAD_DIR: str = "../uploads"
    DASHSCOPE_API_KEY: str = ""
    QWEN_MODEL: str = "qwen3-max"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
