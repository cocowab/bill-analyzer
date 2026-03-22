"""
支付宝账单 CSV 解析器
支付宝导出格式：前 24 行为头部说明，第 25 行起为数据
列：交易时间,交易分类,交易对方,对方账号,商品说明,收/支,金额,收/付款方式,交易状态,交易订单号,商家订单号,备注
"""
import pandas as pd
import json
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.transaction import Transaction
from app.models.import_record import ImportRecord
from app.services.category.classifier import classify


def _find_header_row(filepath: str) -> int:
    for enc in ("utf-8", "gbk"):
        try:
            with open(filepath, encoding=enc) as f:
                for i, line in enumerate(f):
                    if "交易时间" in line:
                        return i
            break
        except UnicodeDecodeError:
            continue
    return 24  # fallback


def parse_alipay_csv(filepath: str, db: Session) -> dict:
    skip = _find_header_row(filepath)
    for enc in ("utf-8", "gbk"):
        try:
            df = pd.read_csv(filepath, skiprows=skip, encoding=enc, on_bad_lines="skip",
                         dtype={"交易订单号": str, "商家订单号": str})
            break
        except UnicodeDecodeError:
            continue

    df.columns = [c.strip() for c in df.columns]
    # 过滤掉末尾汇总行（交易时间列不是有效日期格式的行）
    df = df[df["交易时间"].astype(str).str.match(r"\d{4}-\d{2}-\d{2}")]

    success_count = 0
    skip_count = 0   # 重复单号跳过
    filtered_count = 0  # 非收入/支出过滤
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
                filtered_count += 1
                continue

            amount_str = str(raw.get("金额", "0")).strip()
            amount = float(amount_str)

            # 支付宝交易订单号（兼容旧列名）
            tx_no = str(raw.get("交易订单号", raw.get("交易号", raw.get("账务流水号", "")))).strip()
            date_str = str(raw.get("交易时间", "")).strip()
            try:
                date = datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
            except ValueError:
                date = datetime.strptime(date_str[:10], "%Y-%m-%d")

            if tx_no and db.query(Transaction).filter(Transaction.tx_no == tx_no).first():
                skip_count += 1
                continue

            merchant = str(raw.get("交易对方", "")).strip()
            description = str(raw.get("商品说明", "")).strip()
            alipay_cat = str(raw.get("交易分类", "")).strip()
            category = classify(merchant=merchant, description=description, alipay_category=alipay_cat, flow_type=flow_type)

            tx = Transaction(
                date=date,
                amount=amount,
                flow_type=flow_type,
                category=category,
                merchant=merchant,
                description=description,
                payment_method=str(raw.get("收/付款方式", "支付宝")).strip(),
                tx_no=tx_no,
                merchant_order_no=str(raw.get("商家订单号", "")).strip() or None,
                remark=str(raw.get("备注", "")).strip() or "/",
                source="alipay",
                raw_data=json.dumps(raw, ensure_ascii=False, default=str),
            )
            db.add(tx)
            success_count += 1
        except Exception as e:
            errors.append(str(e))

    db.commit()

    record = ImportRecord(
        filename=filepath.split("/")[-1].split("\\")[-1],
        source="alipay",
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
        "filtered": filtered_count,
        "errors": len(errors),
    }
