from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
import os, shutil, uuid, tempfile

from app.core.database import get_db

router = APIRouter(prefix="/api/upload", tags=["upload"])


def _detect_source(filepath: str, ext: str) -> str:
    """自动检测账单来源：xlsx → wechat；CSV 中含'金额(元)'→ wechat，否则 → alipay"""
    if ext in (".xlsx", ".xls"):
        return "wechat"
    for enc in ("utf-8", "gbk"):
        try:
            with open(filepath, encoding=enc) as f:
                for line in f:
                    if "金额(元)" in line:
                        return "wechat"
                    if "商品说明" in line or "收/付款方式" in line:
                        return "alipay"
            break
        except UnicodeDecodeError:
            continue
    return "wechat"  # fallback


@router.post("/csv")
async def upload_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """上传账单文件，自动识别微信/支付宝格式（支持 CSV / XLSX）"""
    allowed_exts = {".csv", ".xlsx", ".xls"}
    ext = os.path.splitext(file.filename)[-1].lower()
    if ext not in allowed_exts:
        raise HTTPException(status_code=400, detail="只支持 CSV / XLSX 文件")

    # 读入内存
    content = await file.read()

    # 写临时文件用于解析，解析完删除
    suffix = uuid.uuid4().hex[:8]
    tmp_path = os.path.join(tempfile.gettempdir(), f"{suffix}_{file.filename}")
    with open(tmp_path, "wb") as f:
        f.write(content)

    try:
        source = _detect_source(tmp_path, ext)

        if source == "wechat":
            from app.services.parser.wechat_parser import parse_wechat_csv
            result = parse_wechat_csv(tmp_path, db)
        else:
            from app.services.parser.alipay_parser import parse_alipay_csv
            result = parse_alipay_csv(tmp_path, db)
    finally:
        os.remove(tmp_path)

    # 将文件内容存入数据库
    from app.models.import_file import ImportFile
    record = ImportFile(
        filename=file.filename,
        content=content,
        source=source,
        file_size=len(content),
        total=result.get("total"),
        success=result.get("success"),
        skipped=result.get("skipped"),
        filtered=result.get("filtered"),
    )
    db.add(record)
    db.commit()

    return {**result, "source": source}


@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """上传账单图片进行 OCR 识别，返回识别结果供前端确认"""
    allowed = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
    ext = os.path.splitext(file.filename)[-1].lower()
    if ext not in allowed:
        raise HTTPException(status_code=400, detail="只支持 jpg/png/webp/gif 图片")

    # 读入内存
    content = await file.read()

    # 写临时文件用于 OCR，识别完删除
    suffix = uuid.uuid4().hex[:8]
    tmp_path = os.path.join(tempfile.gettempdir(), f"{suffix}_{file.filename}")
    with open(tmp_path, "wb") as f:
        f.write(content)

    try:
        from app.services.ocr.ollama_vision import extract_transactions_from_image
        result = await extract_transactions_from_image(tmp_path, db=db, skip_save=True)
    finally:
        os.remove(tmp_path)

    # 将图片内容存入数据库
    from app.models.ocr_image import OcrImage
    record = OcrImage(
        filename=file.filename,
        content=content,
        file_size=len(content),
        recognized=result.get("recognized", 0),
        status="pending",
    )
    db.add(record)
    db.commit()

    return result


@router.post("/image/save")
async def save_ocr_results(
    data: dict,
    db: Session = Depends(get_db),
):
    """保存 OCR 识别的账单数据到数据库"""
    from app.schemas.transaction import TransactionCreate
    from datetime import datetime

    try:
        transactions = data.get('transactions', [])
        saved = 0
        skipped = 0
        inserted_ids = []

        for tx_data in transactions:
            try:
                tx_obj = TransactionCreate(
                    date=datetime.fromisoformat(tx_data['date']) if isinstance(tx_data['date'], str) else tx_data['date'],
                    amount=float(tx_data['amount']),
                    flow_type=tx_data['flow_type'],
                    category=tx_data.get('category'),
                    merchant=tx_data.get('merchant'),
                    description=tx_data.get('description'),
                    payment_method=tx_data.get('payment_method'),
                    tx_no=tx_data.get('tx_no'),
                    merchant_order_no=tx_data.get('merchant_order_no'),
                    remark=tx_data.get('remark'),
                    source=tx_data.get('source', 'image'),
                )

                from app.models.transaction import Transaction
                from datetime import datetime as dt
                exists = db.query(Transaction).filter(
                    Transaction.date == tx_obj.date,
                    Transaction.amount == tx_obj.amount,
                    Transaction.merchant == tx_obj.merchant,
                    Transaction.source == "image",
                ).first()
                if exists:
                    skipped += 1
                    continue

                tx = Transaction(**tx_obj.model_dump())
                db.add(tx)
                db.flush()
                inserted_ids.append(tx.id)
                saved += 1
            except Exception as e:
                print(f"[OCR Save] Error: {e}")
                skipped += 1

        db.commit()

        # 更新最新一条 pending 的 OcrImage 状态
        from app.models.ocr_image import OcrImage
        ocr_record = db.query(OcrImage).filter(OcrImage.status == "pending").order_by(OcrImage.id.desc()).first()
        if ocr_record:
            ocr_record.saved = saved
            ocr_record.status = "saved"
            db.commit()

        # 记录操作
        from app.services.user_action_logger import log_action, ACTION_IMPORT_OCR
        log_action(
            db,
            ACTION_IMPORT_OCR,
            f"OCR 识别导入账单：成功保存 {saved} 条，跳过 {skipped} 条",
            {"saved": saved, "skipped": skipped, "transaction_ids": inserted_ids},
        )

        return {"saved": saved, "skipped": skipped}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
