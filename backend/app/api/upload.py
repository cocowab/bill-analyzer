from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
import os, shutil, uuid

from app.core.database import get_db
from app.core.config import settings

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

    upload_dir = os.path.abspath(settings.UPLOAD_DIR)
    os.makedirs(upload_dir, exist_ok=True)

    suffix = uuid.uuid4().hex[:8]
    save_path = os.path.join(upload_dir, f"{suffix}_{file.filename}")
    with open(save_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    source = _detect_source(save_path, ext)

    if source == "wechat":
        from app.services.parser.wechat_parser import parse_wechat_csv
        result = parse_wechat_csv(save_path, db)
    else:
        from app.services.parser.alipay_parser import parse_alipay_csv
        result = parse_alipay_csv(save_path, db)

    os.remove(save_path)
    return {**result, "source": source}


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

    from app.services.ocr.ollama_vision import extract_transactions_from_image
    result = await extract_transactions_from_image(save_path, db)
    os.remove(save_path)
    return result
