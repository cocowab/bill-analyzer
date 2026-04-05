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


@router.post("", response_model=dict)
def create_bill(data: dict, db: Session = Depends(get_db)):
    """手动创建单条账单"""
    from app.schemas.transaction import TransactionCreate
    from datetime import datetime
    from app.services.user_action_logger import log_action, ACTION_CREATE_BILL

    try:
        # 转换并验证数据
        tx_data = TransactionCreate(
            date=datetime.fromisoformat(data['date']) if isinstance(data['date'], str) else data['date'],
            amount=float(data['amount']),
            flow_type=data['flow_type'],
            category=data.get('category'),
            merchant=data.get('merchant'),
            description=data.get('description'),
            payment_method=data.get('payment_method'),
            tx_no=data.get('tx_no'),
            merchant_order_no=data.get('merchant_order_no'),
            remark=data.get('remark'),
            source=data.get('source', 'manual'),
        )

        tx = Transaction(**tx_data.model_dump())
        db.add(tx)
        db.commit()
        db.refresh(tx)

        # 记录操作
        log_action(
            db,
            ACTION_CREATE_BILL,
            f"手动添加账单：{data.get('merchant', '未知')} ¥{data['amount']}",
            {"transaction_id": tx.id, "amount": float(data['amount']), "merchant": data.get('merchant')},
        )

        return {"id": tx.id, "ok": True}
    except Exception as e:
        db.rollback()
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{transaction_id}")
def update_bill(transaction_id: int, data: dict, db: Session = Depends(get_db)):
    from app.services.user_action_logger import log_action, ACTION_UPDATE_BILL

    tx = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not tx:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Transaction not found")

    fields = ["date", "amount", "flow_type", "category", "merchant", "description", "payment_method", "remark"]
    for field in fields:
        if field in data:
            val = data[field]
            if field == "date" and isinstance(val, str):
                from datetime import datetime
                val = datetime.fromisoformat(val)
            if field == "amount":
                val = float(val)
            setattr(tx, field, val)

    db.commit()
    log_action(
        db,
        ACTION_UPDATE_BILL,
        f"编辑账单：{tx.merchant} ¥{float(tx.amount)}",
        {"transaction_id": tx.id, "amount": float(tx.amount), "merchant": tx.merchant},
    )
    return {"ok": True}


@router.delete("/{transaction_id}")
def delete_bill(transaction_id: int, db: Session = Depends(get_db)):
    from app.services.user_action_logger import log_action, ACTION_DELETE_BILL

    tx = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not tx:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Transaction not found")

    # 记录操作（删除前）
    log_action(
        db,
        ACTION_DELETE_BILL,
        f"删除账单：{tx.merchant} ¥{float(tx.amount)}",
        {"transaction_id": tx.id, "amount": float(tx.amount), "merchant": tx.merchant},
    )

    db.delete(tx)
    db.commit()
    return {"ok": True}
