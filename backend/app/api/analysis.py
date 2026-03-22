from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


@router.get("/stream")
async def stream_analysis(
    months: int = 3,
    db: Session = Depends(get_db),
):
    """流式返回 AI 消费分析报告（SSE 格式）"""
    from app.services.ai.analyzer import generate_analysis_stream
    return StreamingResponse(
        generate_analysis_stream(db, months),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
