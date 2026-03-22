"""
微信账单解析器，支持 CSV 和 XLSX 格式
微信导出格式：前 16 行为头部说明，第 17 行起为数据
列：交易时间,交易类型,交易对方,商品,收/支,金额(元),支付方式,当前状态,交易单号,商户单号,备注
"""
import os
import re
import pandas as pd
import json
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.transaction import Transaction
from app.models.import_record import ImportRecord
from app.services.category.classifier import classify


def _find_header_row(filepath: str, ext: str) -> int:
    """找到包含'交易时间'的行索引，作为 skiprows 值"""
    if ext in (".xlsx", ".xls"):
        raw = pd.read_excel(filepath, header=None, engine="openpyxl")
        for i, row in raw.iterrows():
            if any("交易时间" in str(v) for v in row.values):
                return i
        return 16  # fallback
    else:
        # CSV：逐行扫描文本，避免因头部行列数不一致导致 pandas 崩溃
        for enc in ("utf-8", "gbk"):
            try:
                with open(filepath, encoding=enc) as f:
                    for i, line in enumerate(f):
                        if "交易时间" in line:
                            return i
                break
            except UnicodeDecodeError:
                continue
        return 16  # fallback


def parse_wechat_csv(filepath: str, db: Session) -> dict:
    ext = os.path.splitext(filepath)[-1].lower()
    skip = _find_header_row(filepath, ext)

    if ext in (".xlsx", ".xls"):
        df = pd.read_excel(filepath, skiprows=skip, engine="openpyxl")
    else:
        for enc in ("utf-8", "gbk"):
            try:
                df = pd.read_csv(filepath, skiprows=skip, encoding=enc)
                break
            except UnicodeDecodeError:
                continue

    # 清理列名空白
    df.columns = [c.strip() for c in df.columns]

    success_count = 0
    skip_count = 0
    errors = []

    for _, row in df.iterrows():
        try:
            raw = row.to_dict()
            flow_str = str(raw.get("收/支", "")).strip()

            if flow_str == "收入":
                flow_type = "income"
            elif flow_str == "支出":
                flow_type = "expense"
            else:
                # 不统计非收入/支出记录（如转账、退款等）
                skip_count += 1
                continue

            amount_str = re.sub(r"[^\d.]", "", str(raw.get("金额(元)", "0")))
            amount = float(amount_str) if amount_str else 0.0

            tx_no = str(raw.get("交易单号", "")).strip()
            date_str = str(raw.get("交易时间", "")).strip()
            try:
                date = datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
            except ValueError:
                date = datetime.strptime(date_str[:10], "%Y-%m-%d")

            # 去重：同交易单号已存在则跳过
            if tx_no and db.query(Transaction).filter(Transaction.tx_no == tx_no).first():
                skip_count += 1
                continue

            merchant = str(raw.get("交易对方", "")).strip()
            description = str(raw.get("商品", "")).strip()
            category = classify(merchant=merchant, description=description)

            tx = Transaction(
                date=date,
                amount=amount,
                flow_type=flow_type,
                category=category,
                merchant=merchant,
                description=description,
                payment_method=str(raw.get("支付方式", "")).strip(),
                tx_no=tx_no,
                merchant_order_no=str(raw.get("商户单号", "")).strip() or None,
                remark=str(raw.get("备注", "")).strip() or None,
                source="wechat",
                raw_data=json.dumps(raw, ensure_ascii=False, default=str),
            )
            db.add(tx)
            success_count += 1
        except Exception as e:
            errors.append(str(e))

    db.commit()

    record = ImportRecord(
        filename=filepath.split("/")[-1].split("\\")[-1],
        source="wechat",
        record_count=len(df),
        success_count=success_count,
        skip_count=skip_count,
        status="success" if not errors else "partial",
        error_msg="; ".join(errors[:3]) if errors else None,
    )
    db.add(record)
    db.commit()

    return {
        "total": len(df),
        "success": success_count,
        "skipped": skip_count,
        "errors": len(errors),
    }
