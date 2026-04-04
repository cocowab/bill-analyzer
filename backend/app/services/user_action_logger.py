"""用户操作日志记录"""

from sqlalchemy.orm import Session
from app.models.user_action import UserAction


def log_action(
    db: Session,
    action_type: str,
    description: str,
    details: dict = None,
) -> None:
    """记录用户操作"""
    try:
        action = UserAction(
            action_type=action_type,
            description=description,
            details=details,
        )
        db.add(action)
        db.commit()
    except Exception as e:
        print(f"[UserActionLogger] Error: {e}")
        db.rollback()


# 操作类型常量
ACTION_CREATE_BILL = "create_bill"  # 手动添加账单
ACTION_UPDATE_BILL = "update_bill"  # 修改账单
ACTION_DELETE_BILL = "delete_bill"  # 删除账单
ACTION_IMPORT_CSV = "import_csv"  # 导入 CSV 账单
ACTION_IMPORT_OCR = "import_ocr"  # OCR 识别导入账单
