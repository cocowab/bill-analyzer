# AI 账单分析 Agent — 工具设计文档

## 架构概述

采用 ReAct Agent 模式，大模型通过多轮"思考→调用工具→观察结果"循环来回答用户的账单相关问题。

- **大模型**：Qwen 远程 API（OpenAI 兼容格式，原生 function calling）
- **工具协议**：OpenAI tool calling 格式
- **流式输出**：SSE
- **当前日期**：通过 system prompt 注入，无需工具

---

## 工具列表

| 编号 | 工具名 | 用途 | 调用频率 |
|------|--------|------|---------|
| 1 | `get_metadata` | 获取账单元信息（分类、数据范围等） | 首轮 / 不确定时 |
| 2 | `analyze_bills` | 统计聚合（总额、占比、排行、趋势） | 高频 |
| 3 | `query_bills` | 查询具体账单明细 | 中频 |
| 4 | `compare_periods` | 两个时间段对比分析 | 问对比/变化时 |

---

## 工具 1：get_metadata

### 描述

获取账单的元数据信息，包括所有分类列表、数据时间范围、各来源笔数、支付方式等。
在不确定用户有哪些分类或数据覆盖范围时调用。

### 输入参数

无。

### 输出

```json
{
    "date_range": {
        "earliest": "2025-12-01",
        "latest": "2026-04-04"
    },
    "total_count": 156,
    "categories": {
        "expense": [
            { "name": "餐饮美食", "count": 55 },
            { "name": "日用百货", "count": 32 },
            { "name": "交通出行", "count": 18 },
            { "name": "服饰装扮", "count": 8 },
            { "name": "其他", "count": 5 }
        ],
        "income": [
            { "name": "工资", "count": 3 },
            { "name": "红包", "count": 5 },
            { "name": "理财", "count": 2 },
            { "name": "其他", "count": 1 }
        ]
    },
    "sources": {
        "wechat": 120,
        "alipay": 36
    },
    "payment_methods": ["微信支付", "零钱", "招商银行信用卡", "花呗", "余额宝"]
}
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `date_range.earliest` | string | 最早一条账单的日期 |
| `date_range.latest` | string | 最新一条账单的日期 |
| `total_count` | int | 账单总条数 |
| `categories.expense` | array | 支出分类列表，含分类名和笔数 |
| `categories.income` | array | 收入分类列表，含分类名和笔数 |
| `sources` | object | 各来源（微信/支付宝）的笔数 |
| `payment_methods` | array | 所有出现过的支付方式 |

---

## 工具 2：analyze_bills

### 描述

统计分析账单数据，返回聚合结果（总额、笔数、分组明细）。
用于回答关于总额、占比、趋势、排行等统计类问题。

### 输入参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `start_date` | string | 否 | 开始日期，格式 YYYY-MM-DD。不传则从最早数据开始 |
| `end_date` | string | 否 | 结束日期，格式 YYYY-MM-DD。不传则到最新数据为止 |
| `flow_type` | string | 否 | `income` 或 `expense`。不传则统计全部 |
| `category` | string | 否 | 分类名称，支持模糊匹配（如传"餐饮"可匹配"餐饮美食"） |
| `merchant` | string | 否 | 商户名称，模糊匹配 |
| `group_by` | string | 是 | 聚合维度：`category` / `day` / `month` / `payment_method` |

### 输出

```json
{
    "query_range": "2026-03-01 ~ 2026-03-31",
    "flow_type": "expense",
    "total_amount": 1280.50,
    "total_count": 45,
    "groups": [
        { "name": "餐饮美食", "amount": 520.00, "count": 22, "percent": 40.6 },
        { "name": "日用百货", "amount": 380.00, "count": 12, "percent": 29.7 },
        { "name": "交通出行", "amount": 180.50, "count": 6, "percent": 14.1 },
        { "name": "服饰装扮", "amount": 120.00, "count": 3, "percent": 9.4 },
        { "name": "其他", "amount": 80.00, "count": 2, "percent": 6.2 }
    ]
}
```

当 `group_by=day` 时，`groups[].name` 为日期字符串：

```json
{
    "query_range": "2026-03-01 ~ 2026-03-31",
    "flow_type": "expense",
    "total_amount": 1280.50,
    "total_count": 45,
    "groups": [
        { "name": "2026-03-01", "amount": 45.00, "count": 3, "percent": 3.5 },
        { "name": "2026-03-02", "amount": 0, "count": 0, "percent": 0 },
        { "name": "2026-03-03", "amount": 120.50, "count": 5, "percent": 9.4 },
        ...
    ]
}
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `query_range` | string | 实际查询的时间范围 |
| `flow_type` | string | 筛选的收支类型，未筛选时为 `all` |
| `total_amount` | float | 匹配条目的总金额 |
| `total_count` | int | 匹配条目的总笔数 |
| `groups` | array | 按 group_by 维度分组的结果 |
| `groups[].name` | string | 分组名称（分类名 / 日期 / 月份 / 支付方式） |
| `groups[].amount` | float | 该组总金额 |
| `groups[].count` | int | 该组笔数 |
| `groups[].percent` | float | 该组金额占总金额的百分比 |

---

## 工具 3：query_bills

### 描述

查询具体账单明细条目。仅在用户需要看到具体交易记录时使用，
如查找最大消费、搜索特定商户的交易、查看某天的具体消费等。

### 输入参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `start_date` | string | 否 | 开始日期，格式 YYYY-MM-DD。不传则从最早数据开始 |
| `end_date` | string | 否 | 结束日期，格式 YYYY-MM-DD。不传则到最新数据为止 |
| `flow_type` | string | 否 | `income` 或 `expense` |
| `category` | string | 否 | 分类名称，模糊匹配 |
| `merchant` | string | 否 | 商户名称，模糊匹配 |
| `keyword` | string | 否 | 关键词搜索，同时匹配商户名、商品描述、备注 |
| `order_by` | string | 否 | 排序字段：`date`（默认）或 `amount` |
| `order_dir` | string | 否 | 排序方向：`desc`（默认）或 `asc` |
| `limit` | int | 否 | 返回条数，默认 10，最大 50 |

### 输出

```json
{
    "total_matched": 22,
    "returned": 10,
    "summary": {
        "total_amount": 520.00,
        "avg_amount": 23.64
    },
    "items": [
        {
            "date": "2026-03-22 18:30:00",
            "amount": 85.00,
            "flow_type": "expense",
            "category": "餐饮美食",
            "merchant": "海底捞火锅",
            "description": "海底捞火锅",
            "payment_method": "微信支付",
            "remark": "/"
        },
        {
            "date": "2026-03-20 12:15:00",
            "amount": 35.50,
            "flow_type": "expense",
            "category": "餐饮美食",
            "merchant": "星巴克",
            "description": "大杯拿铁",
            "payment_method": "招商银行信用卡",
            "remark": "/"
        }
    ]
}
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `total_matched` | int | 符合条件的总条数 |
| `returned` | int | 本次实际返回的条数（受 limit 限制） |
| `summary.total_amount` | float | 所有匹配条目的总金额（非仅返回的） |
| `summary.avg_amount` | float | 所有匹配条目的平均金额 |
| `items` | array | 账单明细列表 |
| `items[].date` | string | 交易时间 |
| `items[].amount` | float | 金额 |
| `items[].flow_type` | string | `income` 或 `expense` |
| `items[].category` | string | 分类 |
| `items[].merchant` | string | 商户/交易对方 |
| `items[].description` | string | 商品描述 |
| `items[].payment_method` | string | 支付方式 |
| `items[].remark` | string | 备注 |

---

## 工具 4：compare_periods

### 描述

对比两个时间段的收支数据，用于环比（本月vs上月）、同比（今年vs去年同期）分析。
一次调用即可获得两段数据及差异，避免调用两次 analyze_bills。

### 输入参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `period_a_start` | string | 是 | 时间段A开始日期，YYYY-MM-DD |
| `period_a_end` | string | 是 | 时间段A结束日期，YYYY-MM-DD |
| `period_b_start` | string | 是 | 时间段B开始日期，YYYY-MM-DD |
| `period_b_end` | string | 是 | 时间段B结束日期，YYYY-MM-DD |
| `flow_type` | string | 否 | `income` 或 `expense` |
| `category` | string | 否 | 分类名称，模糊匹配 |
| `group_by` | string | 否 | 可选分组：`category`。不传则只对比总额 |

### 输出

不分组时：

```json
{
    "period_a": {
        "range": "2026-03-01 ~ 2026-03-31",
        "total_amount": 1280.50,
        "total_count": 45
    },
    "period_b": {
        "range": "2026-02-01 ~ 2026-02-28",
        "total_amount": 980.00,
        "total_count": 38
    },
    "diff": {
        "amount_change": 300.50,
        "amount_percent": "+30.7%",
        "count_change": 7
    }
}
```

带 `group_by=category` 时额外返回分组对比：

```json
{
    "period_a": { "range": "...", "total_amount": 1280.50, "total_count": 45 },
    "period_b": { "range": "...", "total_amount": 980.00, "total_count": 38 },
    "diff": { "amount_change": 300.50, "amount_percent": "+30.7%", "count_change": 7 },
    "group_diff": [
        {
            "name": "餐饮美食",
            "a_amount": 520.00,
            "b_amount": 380.00,
            "change": 140.00,
            "change_percent": "+36.8%"
        },
        {
            "name": "日用百货",
            "a_amount": 380.00,
            "b_amount": 300.00,
            "change": 80.00,
            "change_percent": "+26.7%"
        },
        {
            "name": "交通出行",
            "a_amount": 180.50,
            "b_amount": 200.00,
            "change": -19.50,
            "change_percent": "-9.8%"
        }
    ]
}
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `period_a` | object | 时间段A（通常是较新的时间段）的统计 |
| `period_b` | object | 时间段B（通常是较旧的时间段）的统计 |
| `diff.amount_change` | float | 金额差值（A - B） |
| `diff.amount_percent` | string | 金额变化百分比 |
| `diff.count_change` | int | 笔数差值 |
| `group_diff` | array | 按分组的对比明细（仅 group_by 有值时返回） |
| `group_diff[].name` | string | 分类名 |
| `group_diff[].a_amount` | float | 时间段A该分类金额 |
| `group_diff[].b_amount` | float | 时间段B该分类金额 |
| `group_diff[].change` | float | 差值 |
| `group_diff[].change_percent` | string | 变化百分比 |

---

## 调用流程示例

### 示例 1：「这个月花了多少钱？」

```
用户 → "这个月花了多少钱？"
轮次1: get_metadata()
       → 知道分类结构和数据范围
轮次2: analyze_bills(start_date="2026-04-01", end_date="2026-04-30", flow_type="expense", group_by="category")
       → 拿到本月支出总额和各分类明细
轮次3: 输出最终回答
```

### 示例 2：「花钱最多的一笔是什么？」

```
用户 → "花钱最多的一笔是什么？"
轮次1: query_bills(flow_type="expense", order_by="amount", order_dir="desc", limit=1)
       → 拿到金额最大的一笔消费
轮次2: 输出最终回答
```

### 示例 3：「3月餐饮比2月多了吗？」

```
用户 → "3月餐饮比2月多了吗？"
轮次1: compare_periods(
         period_a_start="2026-03-01", period_a_end="2026-03-31",
         period_b_start="2026-02-01", period_b_end="2026-02-28",
         flow_type="expense", category="餐饮"
       )
       → 一次拿到两月餐饮对比数据
轮次2: 输出最终回答
```

### 示例 4：「帮我分析一下最近的消费」

```
用户 → "帮我分析一下最近的消费"
轮次1: get_metadata()
       → 知道数据范围和分类
轮次2: analyze_bills(start_date="2026-01-01", end_date="2026-04-04", flow_type="expense", group_by="month")
       → 按月趋势
轮次3: analyze_bills(start_date="2026-03-01", end_date="2026-04-04", flow_type="expense", group_by="category")
       → 最近分类占比
轮次4: 综合数据输出分析报告
```

### 示例 5：「我在星巴克花了多少？」

```
用户 → "我在星巴克花了多少？"
轮次1: query_bills(keyword="星巴克", flow_type="expense", order_by="date", limit=20)
       → 拿到明细 + summary.total_amount
轮次2: 输出最终回答（总额 + 消费频次 + 最近几笔）
```
