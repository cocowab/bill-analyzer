from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine
from app.models import Transaction, UserAction, ImportFile, OcrImage, AppSetting  # noqa: F401 触发表创建
from app.core.database import Base
from app.api import bills, stats, upload, analysis, agent_tools
from app.api import settings as settings_router

# 启动时自动建表
Base.metadata.create_all(bind=engine)


app = FastAPI(title="账单分析系统", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(bills.router)
app.include_router(stats.router)
app.include_router(upload.router)
app.include_router(analysis.router)
app.include_router(agent_tools.router)
app.include_router(settings_router.router)


@app.get("/")
def root():
    return {"status": "ok", "message": "账单分析系统 API 运行中"}
