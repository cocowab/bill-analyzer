from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.orm import Session
import os, shutil, uuid

from app.core.database import get_db
from app.core.config import settings

router = APIRouter(prefix="/api/upload", tags=["upload"])


@router.post("/csv")
async def upload_csv(
    file: UploadFile = File(...),
    source: str = Form("wechat"),
    db: Session = Depends(get_db),
):
    """上传微信或支付宝账单文件（支持 CSV / XLSX）"""
    allowed_exts = {".csv", ".xlsx", ".xls"}
    ext = os.path.splitext(file.filename)[-1].lower()
    if ext not in allowed_exts:
        raise HTTPException(status_code=400, detail="只支持 CSV / XLSX 文件")

    upload_dir = os.path.abspath(settings.UPLOAD_DIR)
    os.makedirs(upload_dir, exist_ok=True)

    suffix = uuid.uuid4().hex[:8]
    save_path = os.path.join(upload_dir, f"{suffix}_{file.filename}")
    with open(save_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    if source == "wechat":
        from app.services.parser.wechat_parser import parse_wechat_csv
        result = parse_wechat_csv(save_path, db)
    elif source == "alipay":
        from app.services.parser.alipay_parser import parse_alipay_csv
        result = parse_alipay_csv(save_path, db)
    else:
        raise HTTPException(status_code=400, detail="source 只支持 wechat 或 alipay")

    os.remove(save_path)
    return result


@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """上传账单图片，使用 Claude Vision 识别"""
    allowed = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
    ext = os.path.splitext(file.filename)[-1].lower()
    if ext not in allowed:
        raise HTTPException(status_code=400, detail="只支持 jpg/png/webp/gif 图片")

    upload_dir = os.path.abspath(settings.UPLOAD_DIR)
    os.makedirs(upload_dir, exist_ok=True)

    suffix = uuid.uuid4().hex[:8]
    save_path = os.path.join(upload_dir, f"{suffix}_{file.filename}")
    with open(save_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    from app.services.ocr.claude_vision import extract_transactions_from_image
    result = await extract_transactions_from_image(save_path, db)
    os.remove(save_path)
    return result
