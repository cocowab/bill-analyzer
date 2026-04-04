"""Agent 工具测试端点 — 直接调用每个工具验证结果"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.services.ai.tools import get_metadata, analyze_bills, query_bills, compare_periods

router = APIRouter(prefix="/api/agent-tools", tags=["agent-tools"])


@router.get("/metadata")
def test_metadata(db: Session = Depends(get_db)):
    return get_metadata(db)


@router.get("/analyze")
def test_analyze(
    group_by: str = Query("category"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    flow_type: Optional[str] = None,
    category: Optional[str] = None,
    merchant: Optional[str] = None,
    db: Session = Depends(get_db),
):
    return analyze_bills(
        db,
        group_by=group_by,
        start_date=start_date,
        end_date=end_date,
        flow_type=flow_type,
        category=category,
        merchant=merchant,
    )


@router.get("/query")
def test_query(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    flow_type: Optional[str] = None,
    category: Optional[str] = None,
    merchant: Optional[str] = None,
    keyword: Optional[str] = None,
    order_by: str = "date",
    order_dir: str = "desc",
    limit: int = 10,
    db: Session = Depends(get_db),
):
    return query_bills(
        db,
        start_date=start_date,
        end_date=end_date,
        flow_type=flow_type,
        category=category,
        merchant=merchant,
        keyword=keyword,
        order_by=order_by,
        order_dir=order_dir,
        limit=limit,
    )


@router.get("/compare")
def test_compare(
    period_a_start: str = Query(...),
    period_a_end: str = Query(...),
    period_b_start: str = Query(...),
    period_b_end: str = Query(...),
    flow_type: Optional[str] = None,
    category: Optional[str] = None,
    group_by: Optional[str] = None,
    db: Session = Depends(get_db),
):
    return compare_periods(
        db,
        period_a_start=period_a_start,
        period_a_end=period_a_end,
        period_b_start=period_b_start,
        period_b_end=period_b_end,
        flow_type=flow_type,
        category=category,
        group_by=group_by,
    )
