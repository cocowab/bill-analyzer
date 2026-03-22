from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from decimal import Decimal


class TransactionBase(BaseModel):
    date: datetime
    amount: Decimal
    flow_type: str
    category: Optional[str] = None
    merchant: Optional[str] = None
    description: Optional[str] = None
    payment_method: Optional[str] = None
    tx_no: Optional[str] = None
    merchant_order_no: Optional[str] = None
    remark: Optional[str] = None
    source: str


class TransactionCreate(TransactionBase):
    raw_data: Optional[str] = None


class TransactionOut(TransactionBase):
    id: int
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class TransactionListResponse(BaseModel):
    total: int
    items: List[TransactionOut]


class PeriodSummary(BaseModel):
    income: float
    expense: float
    balance: float


class TimelinePoint(BaseModel):
    date: str
    income: float
    expense: float


class CategoryStat(BaseModel):
    category: str
    amount: float
    percent: float
