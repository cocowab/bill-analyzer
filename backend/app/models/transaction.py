from sqlalchemy import Column, Integer, String, Numeric, DateTime, Text, Index
from sqlalchemy.sql import func
from app.core.database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(DateTime, nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    flow_type = Column(String(10), nullable=False)  # income | expense
    category = Column(String(50), nullable=True)
    merchant = Column(String(200), nullable=True)
    description = Column(String(500), nullable=True)
    payment_method = Column(String(50), nullable=True)
    tx_no = Column(String(100), nullable=True)
    merchant_order_no = Column(String(100), nullable=True)
    remark = Column(String(500), nullable=True)
    source = Column(String(20), nullable=False)  # wechat | alipay | image | manual
    raw_data = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("idx_date", "date"),
        Index("idx_category", "category"),
        Index("idx_flow_type", "flow_type"),
        Index("idx_source", "source"),
    )
