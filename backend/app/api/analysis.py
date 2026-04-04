from fastapi import APIRouter, Depends, Body
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


@router.post("/chat")
async def chat(
    message: str = Body(..., embed=False),
    history: Optional[list] = Body(None, embed=False),
    db: Session = Depends(get_db),
):
    """Agent 对话接口，SSE 流式返回"""
    from app.services.ai.analyzer import agent_chat_stream

    return StreamingResponse(
        agent_chat_stream(db, message, history),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
