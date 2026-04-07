"""
OCR 账单识别：支持本地 Ollama 和远程 OpenAI 兼容接口
"""
import json
import base64
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.transaction import Transaction

# JSON Schema — 约束模型输出结构，配合 constrained decoding 使用
TRANSACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "transactions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "date":             {"type": ["string", "null"]},
                    "amount":           {"type": "number"},
                    "flow_type":        {"type": "string", "enum": ["income", "expense"]},
                    "merchant":         {"type": "string"},
                    "description":      {"type": ["string", "null"]},
                    "category":         {"type": "string"},
                    "payment_method":   {"type": ["string", "null"]},
                    "tx_no":            {"type": ["string", "null"]},
                    "merchant_order_no":{"type": ["string", "null"]},
                    "remark":           {"type": ["string", "null"]},
                },
                "required": ["date", "amount", "flow_type", "merchant", "description", "category"],
            },
        }
    },
    "required": ["transactions"],
}

PROMPT_TEMPLATE = """你是一个专业的中文账单识别助手。请识别图片中的所有交易记录。

当前日期：{today}

严格按照以下 JSON 格式返回，不要输出任何其他文字：

{{
  "transactions": [
    {{
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
    }}
  ]
}}

字段规则：
- date：格式必须是 YYYY-MM-DD HH:MM:SS；无时分秒补 00:00:00；无年份用今年；图片中完全没有日期则填 null
- amount：正数，只含数字和小数点，去掉¥等符号
- flow_type：只能是 income（收入）或 expense（支出）；图片未标注时根据交易场景判断，转账/退款/红包收到为income，消费/购物/扣费为expense
- merchant：商家/收款方名称；图片未写则填"未知"
- description：商品说明或交易描述；图片没有时根据商家推断，实在无法判断填 null
- category：交易分类，支出从以下选择：餐饮美食、购物消费、服饰装扮、数码家电、运动户外、美容美发、交通出行、酒店旅游、娱乐休闲、医疗健康、住房租赁、教育学习、生活缴费、转账红包、其他；收入从以下选择：工资收入、红包收入、理财收益、退款收入、收款转账、其他收入；根据商家和描述判断，无法判断时填其他或其他收入
- payment_method：支付方式，如"微信支付""支付宝""银行卡"；没有则填 null
- tx_no：交易单号/流水号；没有则填 null
- merchant_order_no：商家订单号；没有则填 null
- remark：备注信息；没有则填 null
- 只返回 JSON，不要输出思考过程和任何解释
"""


def _build_prompt() -> str:
    return PROMPT_TEMPLATE.format(today=datetime.now().strftime("%Y-%m-%d"))


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


def _get_ocr_config(db: Session) -> dict:
    from app.models.setting import AppSetting, DEFAULTS
    rows = db.query(AppSetting).filter(
        AppSetting.key.in_([
            "ocr_mode", "ocr_local_model",
            "ocr_remote_base_url", "ocr_remote_api_key", "ocr_remote_model"
        ])
    ).all()
    cfg = {r.key: r.value for r in rows}
    return {
        "mode": cfg.get("ocr_mode") or DEFAULTS["ocr_mode"],
        "local_model": cfg.get("ocr_local_model") or DEFAULTS["ocr_local_model"],
        "remote_base_url": cfg.get("ocr_remote_base_url") or "",
        "remote_api_key": cfg.get("ocr_remote_api_key") or "",
        "remote_model": cfg.get("ocr_remote_model") or "",
    }


async def _call_local(image_path: str, local_model: str) -> str:
    import ollama
    image_b64 = _encode_image(image_path)
    response = ollama.chat(
        model=local_model,
        messages=[{"role": "user", "content": _build_prompt(), "images": [image_b64]}],
        options={"temperature": 0, "think": False},
        format=TRANSACTION_SCHEMA,
    )
    return response["message"]["content"].strip()


async def _call_remote(image_path: str, base_url: str, api_key: str, model: str) -> str:
    from openai import AsyncOpenAI
    import mimetypes
    client = AsyncOpenAI(api_key=api_key or "dummy", base_url=base_url)
    image_b64 = _encode_image(image_path)
    # 检测 MIME 类型
    mime, _ = mimetypes.guess_type(image_path)
    mime = mime or "image/jpeg"
    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{image_b64}"}},
                    {"type": "text", "text": _build_prompt()},
                ],
            }],
            temperature=0,
            max_tokens=2048,
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "transactions",
                    "strict": True,
                    "schema": TRANSACTION_SCHEMA,
                },
            },
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"[OCR Remote] Error: {type(e).__name__}: {e}")
        raise


def _parse_json_with_repair(raw_text: str) -> tuple[dict | None, str]:
    """尝试解析 JSON，失败时逐步修复后重试，返回 (parsed, error_msg)"""
    import re

    text = raw_text.strip()

    # 1. 提取 ```json ... ``` 代码块
    code_block = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if code_block:
        text = code_block.group(1).strip()

    # 2. 提取最外层 { ... }
    start = text.find("{")
    end = text.rfind("}") + 1
    if start == -1 or end == 0:
        return None, "未找到 JSON 对象"
    text = text[start:end]

    # 直接尝试解析
    try:
        return json.loads(text), ""
    except json.JSONDecodeError:
        pass

    # 3. 单引号 → 双引号（简单替换，不破坏内容里的撇号）
    text = re.sub(r"(?<![\\])'", '"', text)
    try:
        return json.loads(text), ""
    except json.JSONDecodeError:
        pass

    # 4. 去除末尾多余逗号（对象和数组末尾）
    text = re.sub(r",\s*([}\]])", r"\1", text)
    try:
        return json.loads(text), ""
    except json.JSONDecodeError:
        pass

    # 5. 截断修复：补全未闭合的 JSON
    # 找到最后一个完整的 transaction 对象，截断后补上 ]} 闭合
    last_complete = text.rfind("},")
    if last_complete == -1:
        last_complete = text.rfind("}")
    if last_complete != -1:
        truncated = text[:last_complete + 1] + "]}"
        try:
            return json.loads(truncated), ""
        except json.JSONDecodeError:
            pass

    return None, "所有修复策略均失败"


def _parse_raw(raw_text: str, transactions_raw: list) -> dict:
    result_txs = []
    for item in transactions_raw:
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
    return {"recognized": len(transactions_raw), "transactions": result_txs}


async def extract_transactions_from_image(
    image_path: str,
    db: Session = None,
    skip_save: bool = False,
) -> dict:
    # 读取配置
    cfg = _get_ocr_config(db) if db else {
        "mode": "local", "local_model": "qwen3-vl:4b",
        "remote_base_url": "", "remote_api_key": "", "remote_model": "",
    }

    # 调用模型
    if cfg["mode"] == "remote" and cfg["remote_base_url"] and cfg["remote_model"]:
        raw_text = await _call_remote(
            image_path, cfg["remote_base_url"], cfg["remote_api_key"], cfg["remote_model"]
        )
    else:
        raw_text = await _call_local(image_path, cfg["local_model"])

    # 解析 JSON（含后处理修复）
    parsed, err = _parse_json_with_repair(raw_text)
    if parsed is None:
        # 自动重试一次
        print(f"[OCR] JSON解析失败，重试: {err}")
        if cfg["mode"] == "remote" and cfg["remote_base_url"] and cfg["remote_model"]:
            raw_text = await _call_remote(
                image_path, cfg["remote_base_url"], cfg["remote_api_key"], cfg["remote_model"]
            )
        else:
            raw_text = await _call_local(image_path, cfg["local_model"])
        parsed, err = _parse_json_with_repair(raw_text)
    if parsed is None:
        return {"recognized": 0, "saved": 0, "error": f"JSON解析失败: {err}", "raw": raw_text}

    transactions = parsed.get("transactions", [])

    if skip_save:
        return _parse_raw(raw_text, transactions)

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
                date=date, amount=amount, flow_type=flow_type,
                category=category, merchant=merchant, description=description,
                payment_method=item.get("payment_method") or "未知",
                tx_no=item.get("tx_no"), merchant_order_no=item.get("merchant_order_no"),
                remark=item.get("remark"), source="image",
                raw_data=json.dumps(item, ensure_ascii=False),
            )
            db.add(tx)
            success_count += 1
        except Exception as e:
            errors.append(str(e))

    db.commit()
    return {"recognized": len(transactions), "saved": success_count, "skipped": skip_count, "errors": errors}
