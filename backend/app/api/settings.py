from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.setting import AppSetting, DEFAULTS

router = APIRouter(prefix="/api/settings", tags=["settings"])

SENSITIVE_KEYS = {"ocr_remote_api_key", "ai_api_key"}


def _mask(key: str, value: str) -> str:
    """API Key 脱敏显示"""
    if key in SENSITIVE_KEYS and value and len(value) > 6:
        return value[:4] + "****" + value[-2:]
    return value


@router.get("")
def get_settings(db: Session = Depends(get_db)):
    rows = db.query(AppSetting).all()
    result = {r.key: r.value for r in rows}
    # 补上缺失的默认值
    for k, v in DEFAULTS.items():
        if k not in result:
            result[k] = v
    # 脱敏
    return {k: _mask(k, v or "") for k, v in result.items()}


@router.put("")
def update_settings(data: dict, db: Session = Depends(get_db)):
    allowed_keys = set(DEFAULTS.keys())
    for key, value in data.items():
        if key not in allowed_keys:
            raise HTTPException(status_code=400, detail=f"不支持的配置项: {key}")
        # 若 API Key 传入的是脱敏值则跳过不更新
        if key in SENSITIVE_KEYS and value and "****" in value:
            continue
        row = db.query(AppSetting).filter(AppSetting.key == key).first()
        if row:
            row.value = value
        else:
            db.add(AppSetting(key=key, value=value))
    db.commit()
    return {"ok": True}
