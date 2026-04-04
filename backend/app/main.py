from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.config import settings
from app.core.database import engine
from app.models import Transaction, ImportRecord  # noqa: F401 触发表创建
from app.core.database import Base
from app.api import bills, stats, upload, analysis, agent_tools

# 启动时自动建表
Base.metadata.create_all(bind=engine)

# 补充新增列（兼容已存在的旧表）
with engine.connect() as conn:
    for col_def in [
        "ALTER TABLE transactions ADD COLUMN merchant_order_no VARCHAR(100)",
        "ALTER TABLE transactions ADD COLUMN remark VARCHAR(500)",
    ]:
        try:
            conn.execute(text(col_def))
            conn.commit()
        except Exception:
            pass  # 列已存在则忽略

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


@app.get("/")
def root():
    return {"status": "ok", "message": "账单分析系统 API 运行中"}
