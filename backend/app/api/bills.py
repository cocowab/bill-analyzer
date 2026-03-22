from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import extract, func
from typing import Optional
from datetime import datetime, timedelta

from app.core.database import get_db
from app.models.transaction import Transaction
from app.schemas.transaction import TransactionListResponse, TransactionOut

router = APIRouter(prefix="/api/bills", tags=["bills"])


@router.get("", response_model=TransactionListResponse)
def list_bills(
    period: str = Query("month", description="year | month | week | day"),
    year: Optional[int] = None,
    month: Optional[int] = None,
    week: Optional[int] = None,
    day: Optional[int] = None,
    flow_type: Optional[str] = None,
    category: Optional[str] = None,
    sort_by: Optional[str] = Query(None, description="date | amount"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    query = db.query(Transaction)

    now = datetime.now()
    if period == "year":
        y = year or now.year
        query = query.filter(extract("year", Transaction.date) == y)
    elif period == "month":
        y = year or now.year
        m = month or now.month
        query = query.filter(
            extract("year", Transaction.date) == y,
            extract("month", Transaction.date) == m,
        )
    elif period == "week":
        y = year or now.year
        w = week or now.isocalendar()[1]
        jan1 = datetime(y, 1, 1)
        week_start = jan1 + timedelta(weeks=w - 1) - timedelta(days=jan1.weekday())
        week_end = week_start + timedelta(days=7)
        query = query.filter(Transaction.date >= week_start, Transaction.date < week_end)
    elif period == "day":
        y = year or now.year
        m = month or now.month
        d = day or now.day
        day_start = datetime(y, m, d)
        day_end = day_start + timedelta(days=1)
        query = query.filter(Transaction.date >= day_start, Transaction.date < day_end)

    if flow_type:
        query = query.filter(Transaction.flow_type == flow_type)
    if category:
        query = query.filter(Transaction.category == category)

    total = query.count()
    order_col = Transaction.amount.desc() if sort_by == "amount" else Transaction.date.desc()
    items = (
        query.order_by(order_col)
        .offset((page - 1) * size)
        .limit(size)
        .all()
    )

    return {"total": total, "items": items}


@router.delete("/{transaction_id}")
def delete_bill(transaction_id: int, db: Session = Depends(get_db)):
    tx = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not tx:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Transaction not found")
    db.delete(tx)
    db.commit()
    return {"ok": True}
