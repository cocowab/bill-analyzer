from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from app.core.database import Base


class ImportRecord(Base):
    __tablename__ = "import_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    filename = Column(String(200), nullable=True)
    source = Column(String(20), nullable=True)
    record_count = Column(Integer, nullable=True)
    success_count = Column(Integer, nullable=True)
    skip_count = Column(Integer, nullable=True)
    status = Column(String(20), nullable=True)  # success | partial | failed
    error_msg = Column(String(500), nullable=True)
    imported_at = Column(DateTime, server_default=func.now())
