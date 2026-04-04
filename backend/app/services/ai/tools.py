"""Agent 工具函数 — 供大模型 tool calling 调用"""

from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func, extract, and_, or_

from app.models.transaction import Transaction


# ---------------------------------------------------------------------------
# 工具 1: get_metadata
# ---------------------------------------------------------------------------

def get_metadata(db: Session) -> dict:
    """获取账单元数据：分类列表、数据时间范围、来源笔数、支付方式"""

    total_count = db.query(func.count(Transaction.id)).scalar() or 0
    if total_count == 0:
        return {
            "date_range": {"earliest": None, "latest": None},
            "total_count": 0,
            "categories": {"expense": [], "income": []},
            "sources": {},
            "payment_methods": [],
        }

    earliest = db.query(func.min(Transaction.date)).scalar()
    latest = db.query(func.max(Transaction.date)).scalar()

    # 按 flow_type 分组统计分类
    cat_rows = (
        db.query(
            Transaction.flow_type,
            Transaction.category,
            func.count(Transaction.id).label("cnt"),
        )
        .group_by(Transaction.flow_type, Transaction.category)
        .all()
    )
    categories: dict = {"expense": [], "income": []}
    for r in cat_rows:
        ft = r.flow_type
        if ft in categories:
            categories[ft].append({
                "name": r.category or "其他",
                "count": r.cnt,
            })
    for ft in categories:
        categories[ft].sort(key=lambda x: x["count"], reverse=True)

    # 来源统计
    source_rows = (
        db.query(Transaction.source, func.count(Transaction.id).label("cnt"))
        .group_by(Transaction.source)
        .all()
    )
    sources = {r.source: r.cnt for r in source_rows}

    # 支付方式
    pm_rows = (
        db.query(Transaction.payment_method)
        .filter(Transaction.payment_method.isnot(None))
        .distinct()
        .all()
    )
    payment_methods = [r[0] for r in pm_rows if r[0]]

    return {
        "date_range": {
            "earliest": earliest.strftime("%Y-%m-%d") if earliest else None,
            "latest": latest.strftime("%Y-%m-%d") if latest else None,
        },
        "total_count": total_count,
        "categories": categories,
        "sources": sources,
        "payment_methods": payment_methods,
    }


# ---------------------------------------------------------------------------
# 工具 2: analyze_bills
# ---------------------------------------------------------------------------

def analyze_bills(
    db: Session,
    group_by: str = "category",
    start_date: str | None = None,
    end_date: str | None = None,
    flow_type: str | None = None,
    category: str | None = None,
    merchant: str | None = None,
    source: str | None = None,
) -> dict:
    """统计聚合账单数据，按指定维度分组返回总额、笔数、占比"""

    filters = []
    if start_date:
        filters.append(Transaction.date >= datetime.strptime(start_date, "%Y-%m-%d"))
    if end_date:
        filters.append(Transaction.date <= datetime.strptime(end_date + " 23:59:59", "%Y-%m-%d %H:%M:%S"))
    if flow_type:
        filters.append(Transaction.flow_type == flow_type)
    if category:
        filters.append(Transaction.category.like(f"%{category}%"))
    if merchant:
        filters.append(Transaction.merchant.like(f"%{merchant}%"))
    if source:
        filters.append(Transaction.source == source)

    base = db.query(Transaction).filter(*filters) if filters else db.query(Transaction)

    total_amount = float(base.with_entities(func.sum(Transaction.amount)).scalar() or 0)
    total_count = base.with_entities(func.count(Transaction.id)).scalar() or 0

    # 确定实际查询范围
    actual_start = base.with_entities(func.min(Transaction.date)).scalar()
    actual_end = base.with_entities(func.max(Transaction.date)).scalar()
    query_range = "无数据"
    if actual_start and actual_end:
        query_range = f"{actual_start.strftime('%Y-%m-%d')} ~ {actual_end.strftime('%Y-%m-%d')}"

    # 分组聚合
    groups = []
    if group_by == "category":
        rows = (
            base.with_entities(
                Transaction.category,
                func.sum(Transaction.amount).label("total"),
                func.count(Transaction.id).label("cnt"),
            )
            .group_by(Transaction.category)
            .order_by(func.sum(Transaction.amount).desc())
            .all()
        )
        for r in rows:
            amt = float(r.total)
            groups.append({
                "name": r.category or "其他",
                "amount": round(amt, 2),
                "count": r.cnt,
                "percent": round(amt / total_amount * 100, 1) if total_amount else 0,
            })

    elif group_by == "day":
        rows = (
            base.with_entities(
                extract("year", Transaction.date).label("y"),
                extract("month", Transaction.date).label("m"),
                extract("day", Transaction.date).label("d"),
                func.sum(Transaction.amount).label("total"),
                func.count(Transaction.id).label("cnt"),
            )
            .group_by("y", "m", "d")
            .order_by("y", "m", "d")
            .all()
        )
        for r in rows:
            amt = float(r.total)
            groups.append({
                "name": f"{int(r.y)}-{int(r.m):02d}-{int(r.d):02d}",
                "amount": round(amt, 2),
                "count": r.cnt,
                "percent": round(amt / total_amount * 100, 1) if total_amount else 0,
            })

    elif group_by == "month":
        rows = (
            base.with_entities(
                extract("year", Transaction.date).label("y"),
                extract("month", Transaction.date).label("m"),
                func.sum(Transaction.amount).label("total"),
                func.count(Transaction.id).label("cnt"),
            )
            .group_by("y", "m")
            .order_by("y", "m")
            .all()
        )
        for r in rows:
            amt = float(r.total)
            groups.append({
                "name": f"{int(r.y)}-{int(r.m):02d}",
                "amount": round(amt, 2),
                "count": r.cnt,
                "percent": round(amt / total_amount * 100, 1) if total_amount else 0,
            })

    elif group_by == "payment_method":
        rows = (
            base.with_entities(
                Transaction.payment_method,
                func.sum(Transaction.amount).label("total"),
                func.count(Transaction.id).label("cnt"),
            )
            .group_by(Transaction.payment_method)
            .order_by(func.sum(Transaction.amount).desc())
            .all()
        )
        for r in rows:
            amt = float(r.total)
            groups.append({
                "name": r.payment_method or "未知",
                "amount": round(amt, 2),
                "count": r.cnt,
                "percent": round(amt / total_amount * 100, 1) if total_amount else 0,
            })

    elif group_by == "source":
        SOURCE_LABELS = {"wechat": "微信", "alipay": "支付宝", "image": "OCR识别", "manual": "手动录入"}
        rows = (
            base.with_entities(
                Transaction.source,
                func.sum(Transaction.amount).label("total"),
                func.count(Transaction.id).label("cnt"),
            )
            .group_by(Transaction.source)
            .order_by(func.sum(Transaction.amount).desc())
            .all()
        )
        for r in rows:
            amt = float(r.total)
            groups.append({
                "name": SOURCE_LABELS.get(r.source, r.source or "未知"),
                "amount": round(amt, 2),
                "count": r.cnt,
                "percent": round(amt / total_amount * 100, 1) if total_amount else 0,
            })

    return {
        "query_range": query_range,
        "flow_type": flow_type or "all",
        "total_amount": round(total_amount, 2),
        "total_count": total_count,
        "groups": groups,
    }


# ---------------------------------------------------------------------------
# 工具 3: query_bills
# ---------------------------------------------------------------------------

def query_bills(
    db: Session,
    start_date: str | None = None,
    end_date: str | None = None,
    flow_type: str | None = None,
    category: str | None = None,
    merchant: str | None = None,
    keyword: str | None = None,
    source: str | None = None,
    order_by: str = "date",
    order_dir: str = "desc",
    limit: int = 10,
) -> dict:
    """查询具体账单明细，支持关键词搜索，返回条目列表及汇总"""

    filters = []
    if start_date:
        filters.append(Transaction.date >= datetime.strptime(start_date, "%Y-%m-%d"))
    if end_date:
        filters.append(Transaction.date <= datetime.strptime(end_date + " 23:59:59", "%Y-%m-%d %H:%M:%S"))
    if flow_type:
        filters.append(Transaction.flow_type == flow_type)
    if category:
        filters.append(Transaction.category.like(f"%{category}%"))
    if merchant:
        filters.append(Transaction.merchant.like(f"%{merchant}%"))
    if keyword:
        filters.append(
            or_(
                Transaction.merchant.like(f"%{keyword}%"),
                Transaction.description.like(f"%{keyword}%"),
                Transaction.remark.like(f"%{keyword}%"),
            )
        )
    if source:
        filters.append(Transaction.source == source)

    base = db.query(Transaction).filter(*filters) if filters else db.query(Transaction)

    # 汇总
    total_matched = base.with_entities(func.count(Transaction.id)).scalar() or 0
    sum_amount = float(base.with_entities(func.sum(Transaction.amount)).scalar() or 0)

    # 排序
    limit = min(max(limit, 1), 50)
    if order_by == "amount":
        order_col = Transaction.amount.desc() if order_dir == "desc" else Transaction.amount.asc()
    else:
        order_col = Transaction.date.desc() if order_dir == "desc" else Transaction.date.asc()

    rows = base.order_by(order_col).limit(limit).all()

    items = []
    for r in rows:
        items.append({
            "date": r.date.strftime("%Y-%m-%d %H:%M:%S") if r.date else "",
            "amount": float(r.amount),
            "flow_type": r.flow_type,
            "category": r.category or "其他",
            "merchant": r.merchant or "",
            "description": r.description or "",
            "payment_method": r.payment_method or "",
            "remark": r.remark or "",
        })

    return {
        "total_matched": total_matched,
        "returned": len(items),
        "summary": {
            "total_amount": round(sum_amount, 2),
            "avg_amount": round(sum_amount / total_matched, 2) if total_matched else 0,
        },
        "items": items,
    }


# ---------------------------------------------------------------------------
# 工具 4: compare_periods
# ---------------------------------------------------------------------------

def _period_stats(db: Session, start: str, end: str, flow_type: str | None, category: str | None):
    """内部辅助：统计一个时间段的数据"""
    filters = [
        Transaction.date >= datetime.strptime(start, "%Y-%m-%d"),
        Transaction.date <= datetime.strptime(end + " 23:59:59", "%Y-%m-%d %H:%M:%S"),
    ]
    if flow_type:
        filters.append(Transaction.flow_type == flow_type)
    if category:
        filters.append(Transaction.category.like(f"%{category}%"))

    base = db.query(Transaction).filter(*filters)
    total = float(base.with_entities(func.sum(Transaction.amount)).scalar() or 0)
    count = base.with_entities(func.count(Transaction.id)).scalar() or 0
    return base, round(total, 2), count


def compare_periods(
    db: Session,
    period_a_start: str,
    period_a_end: str,
    period_b_start: str,
    period_b_end: str,
    flow_type: str | None = None,
    category: str | None = None,
    group_by: str | None = None,
) -> dict:
    """对比两个时间段的收支数据"""

    _, a_total, a_count = _period_stats(db, period_a_start, period_a_end, flow_type, category)
    _, b_total, b_count = _period_stats(db, period_b_start, period_b_end, flow_type, category)

    amount_change = round(a_total - b_total, 2)
    if b_total:
        amount_pct = f"{'+' if amount_change >= 0 else ''}{round(amount_change / b_total * 100, 1)}%"
    else:
        amount_pct = "+100%" if a_total > 0 else "0%"

    result = {
        "period_a": {
            "range": f"{period_a_start} ~ {period_a_end}",
            "total_amount": a_total,
            "total_count": a_count,
        },
        "period_b": {
            "range": f"{period_b_start} ~ {period_b_end}",
            "total_amount": b_total,
            "total_count": b_count,
        },
        "diff": {
            "amount_change": amount_change,
            "amount_percent": amount_pct,
            "count_change": a_count - b_count,
        },
    }

    # 分组对比
    if group_by == "category":
        a_base, _, _ = _period_stats(db, period_a_start, period_a_end, flow_type, category)
        b_base, _, _ = _period_stats(db, period_b_start, period_b_end, flow_type, category)

        a_cats = {
            r.category or "其他": float(r.total)
            for r in a_base.with_entities(
                Transaction.category, func.sum(Transaction.amount).label("total")
            ).group_by(Transaction.category).all()
        }
        b_cats = {
            r.category or "其他": float(r.total)
            for r in b_base.with_entities(
                Transaction.category, func.sum(Transaction.amount).label("total")
            ).group_by(Transaction.category).all()
        }

        all_cats = sorted(set(a_cats) | set(b_cats))
        group_diff = []
        for cat in all_cats:
            a_amt = round(a_cats.get(cat, 0), 2)
            b_amt = round(b_cats.get(cat, 0), 2)
            change = round(a_amt - b_amt, 2)
            if b_amt:
                pct = f"{'+' if change >= 0 else ''}{round(change / b_amt * 100, 1)}%"
            else:
                pct = "+100%" if a_amt > 0 else "0%"
            group_diff.append({
                "name": cat,
                "a_amount": a_amt,
                "b_amount": b_amt,
                "change": change,
                "change_percent": pct,
            })
        group_diff.sort(key=lambda x: abs(x["change"]), reverse=True)
        result["group_diff"] = group_diff

    return result


# ---------------------------------------------------------------------------
# 工具定义（OpenAI tool calling 格式，供 Agent 循环使用）
# ---------------------------------------------------------------------------

TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "get_metadata",
            "description": "获取账单的元数据信息，包括所有分类列表、数据时间范围、各来源笔数、支付方式列表。在不确定有哪些分类或数据范围时调用。",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "analyze_bills",
            "description": "统计分析账单数据，返回按指定维度聚合的结果（总额、笔数、占比）。用于回答关于总额、占比、趋势、排行等统计类问题。",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date": {"type": "string", "description": "开始日期，格式 YYYY-MM-DD。不传则从最早数据开始"},
                    "end_date": {"type": "string", "description": "结束日期，格式 YYYY-MM-DD。不传则到最新数据为止"},
                    "flow_type": {"type": "string", "enum": ["income", "expense"], "description": "收支类型筛选"},
                    "category": {"type": "string", "description": "分类名称，支持模糊匹配"},
                    "merchant": {"type": "string", "description": "商户名称，模糊匹配"},
                    "source": {"type": "string", "enum": ["wechat", "alipay", "image", "manual"], "description": "账单来源筛选：wechat 微信、alipay 支付宝、image OCR识别、manual 手动录入"},
                    "group_by": {"type": "string", "enum": ["category", "day", "month", "payment_method", "source"], "description": "聚合维度"},
                },
                "required": ["group_by"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "query_bills",
            "description": "查询具体账单明细条目，返回交易记录列表及匹配汇总。用于查找最大/最小消费、搜索特定商户的交易、查看某天具体消费等。",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date": {"type": "string", "description": "开始日期，格式 YYYY-MM-DD"},
                    "end_date": {"type": "string", "description": "结束日期，格式 YYYY-MM-DD"},
                    "flow_type": {"type": "string", "enum": ["income", "expense"], "description": "收支类型筛选"},
                    "category": {"type": "string", "description": "分类名称，模糊匹配"},
                    "merchant": {"type": "string", "description": "商户名称，模糊匹配"},
                    "keyword": {"type": "string", "description": "关键词搜索，同时匹配商户名、商品描述、备注"},
                    "source": {"type": "string", "enum": ["wechat", "alipay", "image", "manual"], "description": "账单来源筛选：wechat 微信、alipay 支付宝、image OCR识别、manual 手动录入"},
                    "order_by": {"type": "string", "enum": ["date", "amount"], "description": "排序字段，默认 date"},
                    "order_dir": {"type": "string", "enum": ["asc", "desc"], "description": "排序方向，默认 desc"},
                    "limit": {"type": "integer", "description": "返回条数，默认10，最大50"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "compare_periods",
            "description": "对比两个时间段的收支数据，用于环比（本月vs上月）、同比（今年vs去年同期）分析。一次调用获得两段数据及差异。",
            "parameters": {
                "type": "object",
                "properties": {
                    "period_a_start": {"type": "string", "description": "时间段A开始日期，YYYY-MM-DD"},
                    "period_a_end": {"type": "string", "description": "时间段A结束日期，YYYY-MM-DD"},
                    "period_b_start": {"type": "string", "description": "时间段B开始日期，YYYY-MM-DD"},
                    "period_b_end": {"type": "string", "description": "时间段B结束日期，YYYY-MM-DD"},
                    "flow_type": {"type": "string", "enum": ["income", "expense"], "description": "收支类型筛选"},
                    "category": {"type": "string", "description": "分类名称，模糊匹配"},
                    "group_by": {"type": "string", "enum": ["category"], "description": "分组对比维度，目前仅支持 category"},
                },
                "required": ["period_a_start", "period_a_end", "period_b_start", "period_b_end"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "query_actions",
            "description": "查询用户的操作记录，按时间返回操作列表。用于回答"我最近做了什么操作"、"上次导入是什么时候"、"今天改过哪些账单"等审计类问题。",
            "parameters": {
                "type": "object",
                "properties": {
                    "start_date": {"type": "string", "description": "开始日期，格式 YYYY-MM-DD"},
                    "end_date": {"type": "string", "description": "结束日期，格式 YYYY-MM-DD"},
                    "action_type": {
                        "type": "string",
                        "enum": ["create_bill", "update_bill", "delete_bill", "import_csv", "import_ocr"],
                        "description": "操作类型筛选：create_bill 手动录入、update_bill 修改账单、delete_bill 删除账单、import_csv 导入CSV、import_ocr OCR识别导入"
                    },
                    "limit": {"type": "integer", "description": "返回条数，默认20，最大100"},
                },
                "required": [],
            },
        },
    },
]


# ---------------------------------------------------------------------------
# 工具 5: query_actions
# ---------------------------------------------------------------------------

def query_actions(
    db: Session,
    start_date: str | None = None,
    end_date: str | None = None,
    action_type: str | None = None,
    limit: int = 20,
) -> dict:
    """查询用户操作记录，按时间返回操作列表"""
    from app.models.user_action import UserAction

    filters = []
    if start_date:
        filters.append(UserAction.created_at >= datetime.strptime(start_date, "%Y-%m-%d"))
    if end_date:
        filters.append(UserAction.created_at <= datetime.strptime(end_date + " 23:59:59", "%Y-%m-%d %H:%M:%S"))
    if action_type:
        filters.append(UserAction.action_type == action_type)

    base = db.query(UserAction).filter(*filters) if filters else db.query(UserAction)
    total = base.with_entities(func.count(UserAction.id)).scalar() or 0
    limit = min(max(limit, 1), 100)
    rows = base.order_by(UserAction.created_at.desc()).limit(limit).all()

    ACTION_LABELS = {
        "create_bill": "手动录入账单",
        "update_bill": "修改账单",
        "delete_bill": "删除账单",
        "import_csv": "导入CSV账单",
        "import_ocr": "OCR识别导入",
    }

    items = []
    for r in rows:
        items.append({
            "time": r.created_at.strftime("%Y-%m-%d %H:%M:%S") if r.created_at else "",
            "action_type": r.action_type,
            "action_label": ACTION_LABELS.get(r.action_type, r.action_type),
            "description": r.description or "",
            "details": r.details,
        })

    return {
        "total_matched": total,
        "returned": len(items),
        "items": items,
    }


# ---------------------------------------------------------------------------
# 工具调度器 — 根据函数名调用对应工具
# ---------------------------------------------------------------------------

def execute_tool(db: Session, tool_name: str, arguments: dict) -> dict:
    """根据工具名称执行对应函数，返回结果 dict"""
    if tool_name == "get_metadata":
        return get_metadata(db)
    elif tool_name == "analyze_bills":
        return analyze_bills(db, **arguments)
    elif tool_name == "query_bills":
        return query_bills(db, **arguments)
    elif tool_name == "compare_periods":
        return compare_periods(db, **arguments)
    elif tool_name == "query_actions":
        return query_actions(db, **arguments)
    else:
        return {"error": f"未知工具: {tool_name}"}
