from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import extract, func
from typing import Optional, List
from datetime import datetime, timedelta

from app.core.database import get_db
from app.models.transaction import Transaction
from app.schemas.transaction import PeriodSummary, TimelinePoint, CategoryStat

router = APIRouter(prefix="/api/stats", tags=["stats"])


def _period_filter(query, period: str, year: int, month: int = None, week: int = None):
    if period == "year":
        return query.filter(extract("year", Transaction.date) == year)
    elif period == "month":
        return query.filter(
            extract("year", Transaction.date) == year,
            extract("month", Transaction.date) == month,
        )
    elif period == "week":
        jan1 = datetime(year, 1, 1)
        week_start = jan1 + timedelta(weeks=week - 1) - timedelta(days=jan1.weekday())
        week_end = week_start + timedelta(days=7)
        return query.filter(Transaction.date >= week_start, Transaction.date < week_end)
    return query


@router.get("/summary", response_model=PeriodSummary)
def get_summary(
    period: str = Query("month"),
    year: Optional[int] = None,
    month: Optional[int] = None,
    week: Optional[int] = None,
    db: Session = Depends(get_db),
):
    now = datetime.now()
    y = year or now.year
    m = month or now.month
    w = week or now.isocalendar()[1]

    base = db.query(Transaction)
    base = _period_filter(base, period, y, m, w)

    income = base.filter(Transaction.flow_type == "income").with_entities(
        func.sum(Transaction.amount)
    ).scalar() or 0

    expense = base.filter(Transaction.flow_type == "expense").with_entities(
        func.sum(Transaction.amount)
    ).scalar() or 0

    return {
        "income": float(income),
        "expense": float(expense),
        "balance": float(income) - float(expense),
    }


@router.get("/timeline", response_model=List[TimelinePoint])
def get_timeline(
    period: str = Query("month", description="按什么粒度聚合: month=每月, week=每周, day=每日"),
    start: Optional[str] = None,
    end: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """折线图数据：时间段内每个粒度的收支汇总"""
    now = datetime.now()
    if not start:
        start = f"{now.year - 1}-{now.month:02d}"
    if not end:
        end = f"{now.year}-{now.month:02d}"

    start_dt = datetime.strptime(start + "-01", "%Y-%m-%d")
    # end 取到下个月初
    end_parts = end.split("-")
    ey, em = int(end_parts[0]), int(end_parts[1])
    if em == 12:
        end_dt = datetime(ey + 1, 1, 1)
    else:
        end_dt = datetime(ey, em + 1, 1)

    if period == "day":
        rows = (
            db.query(
                extract("year", Transaction.date).label("y"),
                extract("month", Transaction.date).label("m"),
                extract("day", Transaction.date).label("d"),
                Transaction.flow_type,
                func.sum(Transaction.amount).label("total"),
            )
            .filter(Transaction.date >= start_dt, Transaction.date < end_dt)
            .group_by("y", "m", "d", Transaction.flow_type)
            .all()
        )
        data: dict = {}
        for row in rows:
            key = f"{int(row.y)}-{int(row.m):02d}-{int(row.d):02d}"
            if key not in data:
                data[key] = {"income": 0.0, "expense": 0.0}
            if row.flow_type == "income":
                data[key]["income"] = float(row.total)
            elif row.flow_type == "expense":
                data[key]["expense"] = float(row.total)
    else:
        rows = (
            db.query(
                extract("year", Transaction.date).label("y"),
                extract("month", Transaction.date).label("m"),
                Transaction.flow_type,
                func.sum(Transaction.amount).label("total"),
            )
            .filter(Transaction.date >= start_dt, Transaction.date < end_dt)
            .group_by("y", "m", Transaction.flow_type)
            .all()
        )
        data: dict = {}
        for row in rows:
            key = f"{int(row.y)}-{int(row.m):02d}"
            if key not in data:
                data[key] = {"income": 0.0, "expense": 0.0}
            if row.flow_type == "income":
                data[key]["income"] = float(row.total)
            elif row.flow_type == "expense":
                data[key]["expense"] = float(row.total)

    result = [
        {"date": k, "income": v["income"], "expense": v["expense"]}
        for k, v in sorted(data.items())
    ]
    return result


@router.get("/category", response_model=List[CategoryStat])
def get_category_stats(
    period: str = Query("month"),
    year: Optional[int] = None,
    month: Optional[int] = None,
    week: Optional[int] = None,
    flow_type: str = Query("expense"),
    db: Session = Depends(get_db),
):
    """饼图数据：按分类汇总（支出或收入）"""
    now = datetime.now()
    y = year or now.year
    m = month or now.month
    w = week or now.isocalendar()[1]

    base = db.query(Transaction).filter(Transaction.flow_type == flow_type)
    base = _period_filter(base, period, y, m, w)

    rows = (
        base.with_entities(
            Transaction.category,
            func.sum(Transaction.amount).label("total"),
        )
        .group_by(Transaction.category)
        .all()
    )

    total_all = sum(float(r.total) for r in rows)
    result = []
    for r in rows:
        amt = float(r.total)
        result.append({
            "category": r.category or "其他",
            "amount": amt,
            "percent": round(amt / total_all * 100, 2) if total_all > 0 else 0,
        })

    return sorted(result, key=lambda x: x["amount"], reverse=True)
