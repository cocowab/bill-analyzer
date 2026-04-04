"""AI 账单分析 Agent — ReAct 模式，通过 tool calling 多轮调用工具"""

import json
from datetime import datetime
from typing import AsyncGenerator

from openai import AsyncOpenAI
from sqlalchemy.orm import Session

from app.services.ai.tools import TOOL_DEFINITIONS, execute_tool


SYSTEM_PROMPT = """你是一位专业的个人财务分析师，帮助用户分析他们的账单数据。

当前日期：{today}

你可以通过调用工具来获取用户的账单数据，然后基于数据给出分析和建议。

工作流程：
1. 如果不确定用户有哪些分类或数据范围，先调用 get_metadata 获取元信息
2. 根据用户问题选择合适的工具获取数据
3. 基于获取到的数据给出清晰、有条理的分析

注意事项：
- 金额单位是人民币（¥）
- 回答要简洁明了，使用 Markdown 格式
- 如果数据不足以回答问题，如实告知用户
- 不要编造数据，所有数据必须来自工具返回的结果"""


def _get_ai_config(db: Session) -> dict:
    """从数据库读取 AI 配置，缺失时用默认值"""
    from app.models.setting import AppSetting, DEFAULTS
    rows = db.query(AppSetting).filter(
        AppSetting.key.in_(["ai_base_url", "ai_api_key", "ai_model"])
    ).all()
    cfg = {r.key: r.value for r in rows}
    return {
        "base_url": cfg.get("ai_base_url") or DEFAULTS["ai_base_url"],
        "api_key": cfg.get("ai_api_key") or "",
        "model": cfg.get("ai_model") or DEFAULTS["ai_model"],
    }


def _get_client(base_url: str, api_key: str) -> AsyncOpenAI:
    return AsyncOpenAI(api_key=api_key or "dummy", base_url=base_url)


def _is_dashscope(base_url: str) -> bool:
    return "dashscope.aliyuncs.com" in base_url


async def agent_chat_stream(
    db: Session,
    user_message: str,
    history: list[dict] | None = None,
) -> AsyncGenerator[str, None]:
    """Agent 对话流式输出，支持多轮 tool calling"""

    cfg = _get_ai_config(db)
    client = _get_client(cfg["base_url"], cfg["api_key"])
    model = cfg["model"]
    use_thinking_param = _is_dashscope(cfg["base_url"])

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT.format(today=datetime.now().strftime("%Y-%m-%d"))},
    ]
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": user_message})

    max_rounds = 10

    for round_idx in range(max_rounds):
        print(f"\n[Agent] Round {round_idx + 1}, messages count: {len(messages)}")

        kwargs = dict(
            model=model,
            messages=messages,
            tools=TOOL_DEFINITIONS,
        )
        if use_thinking_param:
            kwargs["extra_body"] = {"enable_thinking": False}

        response = await client.chat.completions.create(**kwargs)

        choice = response.choices[0]
        assistant_msg = choice.message

        # 没有 tool_calls → 最终回答，直接发完整文本，前端模拟流式
        if not assistant_msg.tool_calls:
            print(f"[Agent] Got final answer, sending full content...")
            content = assistant_msg.content or ""
            yield f"data: {json.dumps({'type': 'full_content', 'text': content}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
            return

        # 有 tool_calls → 执行工具
        messages.append({
            "role": "assistant",
            "content": assistant_msg.content or "",
            "tool_calls": [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    },
                }
                for tc in assistant_msg.tool_calls
            ],
        })

        for tc in assistant_msg.tool_calls:
            tool_name = tc.function.name
            try:
                arguments = json.loads(tc.function.arguments)
            except json.JSONDecodeError:
                arguments = {}

            print(f"[Agent] Calling tool: {tool_name}({json.dumps(arguments, ensure_ascii=False)})")

            yield f"data: {json.dumps({'type': 'tool_call', 'name': tool_name, 'arguments': arguments}, ensure_ascii=False)}\n\n"

            result = execute_tool(db, tool_name, arguments)
            result_str = json.dumps(result, ensure_ascii=False)

            print(f"[Agent] Tool result: {result_str[:200]}...")

            yield f"data: {json.dumps({'type': 'tool_result', 'name': tool_name, 'result': result}, ensure_ascii=False)}\n\n"

            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": result_str,
            })

        yield f"data: {json.dumps({'type': 'thinking'})}\n\n"

    yield f"data: {json.dumps({'type': 'content', 'text': '抱歉，分析过程过于复杂，请尝试简化您的问题。'}, ensure_ascii=False)}\n\n"
    yield f"data: {json.dumps({'type': 'done'})}\n\n"
