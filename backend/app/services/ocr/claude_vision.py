"""
使用 Claude Vision API 识别账单图片，提取结构化交易记录
"""
import base64
import json
import os
from datetime import datetime
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.transaction import Transaction
from app.services.category.classifier import classify

SYSTEM_PROMPT = """你是一个专业的账单识别助手。
用户会给你一张账单截图（微信、支付宝、银行卡账单等），请识别其中所有的交易记录。
请严格按照以下 JSON 格式返回，不要有任何多余文字：

{
  "transactions": [
    {
      "date": "YYYY-MM-DD HH:MM:SS",
      "amount": 12.50,
      "flow_type": "expense",
      "merchant": "商家名称",
      "description": "商品描述",
      "payment_method": "支付方式"
    }
  ]
}

规则：
- flow_type 只能是 income（收入）、expense（支出）、transfer（转账）
- amount 为正数
- 如果时间只有日期没有时分秒，补充为 00:00:00
- 如果某字段无法识别，设为 null
"""


async def extract_transactions_from_image(image_path: str, db: Session) -> dict:
    import anthropic

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    with open(image_path, "rb") as f:
        image_data = base64.standard_b64encode(f.read()).decode("utf-8")

    ext = os.path.splitext(image_path)[-1].lower()
    media_type_map = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".gif": "image/gif",
    }
    media_type = media_type_map.get(ext, "image/jpeg")

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": image_data,
                        },
                    },
                    {"type": "text", "text": "请识别这张账单图片中的所有交易记录。"},
                ],
            }
        ],
    )

    raw_text = message.content[0].text.strip()
    # 提取 JSON 部分
    start = raw_text.find("{")
    end = raw_text.rfind("}") + 1
    parsed = json.loads(raw_text[start:end])

    transactions = parsed.get("transactions", [])
    success_count = 0

    for item in transactions:
        try:
            date_str = item.get("date", "")
            try:
                date = datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
            except ValueError:
                date = datetime.strptime(date_str[:10], "%Y-%m-%d")

            merchant = item.get("merchant") or ""
            description = item.get("description") or ""
            category = classify(merchant=merchant, description=description)

            tx = Transaction(
                date=date,
                amount=float(item.get("amount", 0)),
                flow_type=item.get("flow_type", "expense"),
                category=category,
                merchant=merchant,
                description=description,
                payment_method=item.get("payment_method"),
                source="image",
                raw_data=json.dumps(item, ensure_ascii=False),
            )
            db.add(tx)
            success_count += 1
        except Exception:
            pass

    db.commit()

    return {
        "recognized": len(transactions),
        "saved": success_count,
        "preview": transactions,
    }
