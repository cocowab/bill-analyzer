"""
Claude API 消费分析服务（流式输出）
"""
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import extract, func
from typing import AsyncGenerator

from app.models.transaction import Transaction
from app.core.config import settings


def _build_stats_summary(db: Session, months: int) -> str:
    """从数据库提取最近 N 个月的统计数据，构造给 Claude 的数据摘要文本"""
    now = datetime.now()
    start = now - timedelta(days=30 * months)

    rows = (
        db.query(
            extract("year", Transaction.date).label("y"),
            extract("month", Transaction.date).label("m"),
            Transaction.flow_type,
            Transaction.category,
            func.sum(Transaction.amount).label("total"),
            func.count(Transaction.id).label("cnt"),
        )
        .filter(Transaction.date >= start)
        .group_by("y", "m", Transaction.flow_type, Transaction.category)
        .all()
    )

    if not rows:
        return "暂无消费数据。"

    # 按月汇总
    monthly: dict = {}
    for r in rows:
        key = f"{int(r.y)}-{int(r.m):02d}"
        if key not in monthly:
            monthly[key] = {"income": 0.0, "expense": 0.0, "categories": {}}
        if r.flow_type == "income":
            monthly[key]["income"] += float(r.total)
        elif r.flow_type == "expense":
            monthly[key]["expense"] += float(r.total)
            cat = r.category or "其他"
            monthly[key]["categories"][cat] = monthly[key]["categories"].get(cat, 0.0) + float(r.total)

    lines = [f"以下是用户最近 {months} 个月的消费数据摘要：\n"]
    for month, data in sorted(monthly.items()):
        lines.append(f"【{month}】")
        lines.append(f"  收入: ¥{data['income']:.2f}，支出: ¥{data['expense']:.2f}，结余: ¥{data['income'] - data['expense']:.2f}")
        if data["categories"]:
            sorted_cats = sorted(data["categories"].items(), key=lambda x: x[1], reverse=True)
            cat_str = "、".join([f"{c}¥{a:.0f}" for c, a in sorted_cats[:6]])
            lines.append(f"  支出分类: {cat_str}")

    return "\n".join(lines)


SYSTEM_PROMPT = """你是一位专业的个人财务分析师。
请根据用户提供的消费数据，用中文提供客观、具体、个性化的消费分析和建议。

输出格式（使用 Markdown）：
1. **消费概况** - 收支总结和趋势
2. **消费结构分析** - 各类支出占比和评价
3. **异常消费识别** - 如有异常大额或频繁小额消费请指出
4. **个性化建议** - 3-5条具体可操作的建议

语气：客观、友好、专业，避免说教。数据要引用具体数字。"""


async def generate_analysis_stream(db: Session, months: int) -> AsyncGenerator[str, None]:
    import anthropic

    summary = _build_stats_summary(db, months)
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    with client.messages.stream(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": summary}],
    ) as stream:
        for text in stream.text_stream:
            yield f"data: {text}\n\n"

    yield "data: [DONE]\n\n"
