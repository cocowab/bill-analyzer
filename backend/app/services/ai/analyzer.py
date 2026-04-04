"""AI 账单分析 Agent — ReAct 模式，通过 tool calling 多轮调用工具"""

import json
from datetime import datetime
from typing import AsyncGenerator

from openai import AsyncOpenAI
from sqlalchemy.orm import Session

from app.core.config import settings
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


def _get_client() -> AsyncOpenAI:
    return AsyncOpenAI(
        api_key=settings.DASHSCOPE_API_KEY,
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
    )


async def agent_chat_stream(
    db: Session,
    user_message: str,
    history: list[dict] | None = None,
) -> AsyncGenerator[str, None]:
    """Agent 对话流式输出，支持多轮 tool calling"""

    client = _get_client()

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT.format(today=datetime.now().strftime("%Y-%m-%d"))},
    ]
    if history:
        messages.extend(history)
    messages.append({"role": "user", "content": user_message})

    max_rounds = 10

    for round_idx in range(max_rounds):
        print(f"\n[Agent] Round {round_idx + 1}, messages count: {len(messages)}")

        response = await client.chat.completions.create(
            model=settings.QWEN_MODEL,
            messages=messages,
            tools=TOOL_DEFINITIONS,
            extra_body={"enable_thinking": False},
        )

        choice = response.choices[0]
        assistant_msg = choice.message

        # 没有 tool_calls → 最终回答，真正流式输出
        if not assistant_msg.tool_calls:
            print(f"[Agent] Generating final answer (streaming)...")
            # 通知前端进入思考状态
            yield f"data: {json.dumps({'type': 'thinking'})}\n\n"
            # 重新请求一次，这次用 stream=True
            stream = await client.chat.completions.create(
                model=settings.QWEN_MODEL,
                messages=messages,
                tools=TOOL_DEFINITIONS,
                stream=True,
                extra_body={"enable_thinking": False},
            )
            async for chunk in stream:
                delta = chunk.choices[0].delta
                if delta.content:
                    yield f"data: {json.dumps({'type': 'content', 'text': delta.content}, ensure_ascii=False)}\n\n"
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

            # 通知前端正在调用工具
            yield f"data: {json.dumps({'type': 'tool_call', 'name': tool_name, 'arguments': arguments}, ensure_ascii=False)}\n\n"

            # 执行工具
            result = execute_tool(db, tool_name, arguments)
            result_str = json.dumps(result, ensure_ascii=False)

            print(f"[Agent] Tool result: {result_str[:200]}...")

            # 通知前端工具执行完成
            yield f"data: {json.dumps({'type': 'tool_result', 'name': tool_name, 'result': result}, ensure_ascii=False)}\n\n"

            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": result_str,
            })

        # 本轮工具全部执行完毕，通知前端正在思考下一步
        yield f"data: {json.dumps({'type': 'thinking'})}\n\n"

    # 超过最大轮次
    yield f"data: {json.dumps({'type': 'content', 'text': '抱歉，分析过程过于复杂，请尝试简化您的问题。'}, ensure_ascii=False)}\n\n"
    yield f"data: {json.dumps({'type': 'done'})}\n\n"
