"""
使用本地 Ollama (qwen3-vl:4b) 识别账单图片，提取结构化交易记录
"""
import json
import base64
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.transaction import Transaction

OLLAMA_MODEL = "qwen3-vl:4b"

PROMPT = """你是一个专业的中文账单识别助手。请识别图片中的所有交易记录。

严格按照以下 JSON 格式返回，不要输出任何其他文字：

{
  "transactions": [
    {
      "date": "YYYY-MM-DD HH:MM:SS",
      "amount": 12.50,
      "flow_type": "expense",
      "merchant": "商家名称",
      "description": "交易描述/商品说明",
      "category": "餐饮美食",
      "payment_method": "微信支付",
      "tx_no": "交易单号",
      "merchant_order_no": "商家订单号",
      "remark": "备注"
    }
  ]
}

字段规则：
- date：格式必须是 YYYY-MM-DD HH:MM:SS；无时分秒补 00:00:00；无年份用今年；图片中完全没有日期则填 null
- amount：正数，只含数字和小数点，去掉¥等符号
- flow_type：只能是 income（收入）或 expense（支出）；图片未标注时根据交易场景判断，转账/退款/红包收到为income，消费/购物/扣费为expense
- merchant：商家/收款方名称；图片未写则填"未知"
- description：商品说明或交易描述；图片没有时根据商家推断，实在无法判断填 null
- category：交易分类，支出从以下选择：餐饮美食、购物消费、交通出行、娱乐休闲、医疗健康、住房租赁、教育学习、生活缴费、转账红包、其他；收入从以下选择：工资收入、红包收入、理财收益、退款收入、收款转账、其他收入；根据商家和描述判断，无法判断时收入填其他或其他收入
- payment_method：支付方式，如"微信支付""支付宝""银行卡"；没有则填 null
- tx_no：交易单号/流水号；没有则填 null
- merchant_order_no：商家订单号；没有则填 null
- remark：备注信息；没有则填 null
- 只返回 JSON，不要输出思考过程和任何解释
"""


def _encode_image(image_path: str) -> str:
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def _parse_date(date_str) -> datetime:
    if not date_str:
        raise ValueError("缺少日期")
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except ValueError:
            continue
    raise ValueError(f"无法解析日期: {date_str}")


async def extract_transactions_from_image(image_path: str, db: Session = None, skip_save: bool = False) -> dict:
    import ollama

    image_b64 = _encode_image(image_path)

    response = ollama.chat(
        model=OLLAMA_MODEL,
        messages=[
            {
                "role": "user",
                "content": PROMPT,
                "images": [image_b64],
            }
        ],
        options={"temperature": 0, "think": False},
    )

    raw_text = response["message"]["content"].strip()

    # 提取 JSON 部分（防止模型输出多余文字）
    start = raw_text.find("{")
    end = raw_text.rfind("}") + 1
    if start == -1 or end == 0:
        return {"recognized": 0, "saved": 0, "error": "模型未返回有效JSON", "raw": raw_text}

    try:
        parsed = json.loads(raw_text[start:end])
    except json.JSONDecodeError as e:
        return {"recognized": 0, "saved": 0, "error": f"JSON解析失败: {e}", "raw": raw_text}

    transactions = parsed.get("transactions", [])

    # 如果只是识别不保存，直接返回
    if skip_save:
        result_txs = []
        for item in transactions:
            try:
                date = _parse_date(item.get("date", ""))
                raw_amount = item.get("amount")
                if raw_amount is None:
                    continue
                amount = float(raw_amount)
                if amount <= 0:
                    continue

                flow_type = item.get("flow_type", "expense")
                if flow_type not in ("income", "expense"):
                    flow_type = "expense"

                result_txs.append({
                    "date": date.isoformat(),
                    "amount": amount,
                    "flow_type": flow_type,
                    "category": item.get("category") or ("其他收入" if flow_type == "income" else "其他"),
                    "merchant": item.get("merchant") or "未知",
                    "description": item.get("description"),
                    "payment_method": item.get("payment_method"),
                    "tx_no": item.get("tx_no"),
                    "merchant_order_no": item.get("merchant_order_no"),
                    "remark": item.get("remark"),
                    "source": "image",
                })
            except Exception:
                continue
        return {"recognized": len(transactions), "transactions": result_txs}

    # 保存到数据库
    success_count = 0
    skip_count = 0
    errors = []

    for item in transactions:
        try:
            date = _parse_date(item.get("date", ""))
            raw_amount = item.get("amount")
            if raw_amount is None:
                raise ValueError("缺少金额")
            amount = float(raw_amount)
            if amount <= 0:
                raise ValueError(f"无效金额: {raw_amount}")

            flow_type = item.get("flow_type", "expense")
            if flow_type not in ("income", "expense"):
                flow_type = "expense"

            merchant = item.get("merchant") or "未知"
            description = item.get("description")
            category = item.get("category") or ("其他收入" if flow_type == "income" else "其他")

            exists = db.query(Transaction).filter(
                Transaction.date == date,
                Transaction.amount == amount,
                Transaction.merchant == merchant,
                Transaction.source == "image",
            ).first()
            if exists:
                skip_count += 1
                continue

            tx = Transaction(
                date=date,
                amount=amount,
                flow_type=flow_type,
                category=category,
                merchant=merchant,
                description=description,
                payment_method=item.get("payment_method") or "未知",
                tx_no=item.get("tx_no"),
                merchant_order_no=item.get("merchant_order_no"),
                remark=item.get("remark"),
                source="image",
                raw_data=json.dumps(item, ensure_ascii=False),
            )
            db.add(tx)
            success_count += 1
        except Exception as e:
            errors.append(str(e))

    db.commit()

    return {
        "recognized": len(transactions),
        "saved": success_count,
        "skipped": skip_count,
        "errors": errors,
    }
