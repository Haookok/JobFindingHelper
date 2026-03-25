"""
AI 服务层，封装 OpenAI API 调用。
当前为占位实现，配置 OPENAI_API_KEY 后可接入真实 AI 能力。
"""

import os

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")


async def generate_interview_question(
    position: str,
    stage: str,
    difficulty: str,
    context: list[dict],
) -> str:
    """根据面试上下文生成下一个问题"""
    if not OPENAI_API_KEY:
        return f"[{stage}] 这是一个示例问题。请配置 OPENAI_API_KEY 以启用 AI 生成。"

    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=OPENAI_API_KEY)

    system_prompt = (
        f"你是一位资深的{position}面试官，正在进行「{stage}」环节。"
        f"面试难度为「{difficulty}」。"
        "请基于候选人之前的回答，提出下一个有深度的面试问题。"
        "要求：严格但友善，通过追问引导思考，不直接给答案。"
    )

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(context)
    messages.append({"role": "user", "content": "请提出下一个面试问题。"})

    response = await client.chat.completions.create(model=OPENAI_MODEL, messages=messages, max_tokens=500)
    return response.choices[0].message.content or ""


async def evaluate_answer(question: str, answer: str, key_points: list[str]) -> dict:
    """评估面试回答"""
    if not OPENAI_API_KEY:
        return {
            "score": 0,
            "feedback": "请配置 OPENAI_API_KEY 以启用 AI 评估。",
            "key_points_hit": [],
            "suggestions": [],
        }

    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=OPENAI_API_KEY)

    system_prompt = (
        "你是一位经验丰富的技术面试官，请评估候选人的回答。\n"
        f"面试问题：{question}\n"
        f"参考要点：{', '.join(key_points)}\n"
        "请从以下维度评分（总分 100）：\n"
        "- 准确性（40%）：知识点是否正确\n"
        "- 深度（30%）：是否理解底层原理\n"
        "- 表达（20%）：逻辑是否清晰\n"
        "- 扩展（10%）：能否联系实际场景\n"
        "返回 JSON 格式：{score, feedback, key_points_hit, suggestions}"
    )

    response = await client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"候选人回答：{answer}"},
        ],
        max_tokens=800,
        response_format={"type": "json_object"},
    )

    import json
    try:
        return json.loads(response.choices[0].message.content or "{}")
    except json.JSONDecodeError:
        return {"score": 0, "feedback": "评估解析失败", "key_points_hit": [], "suggestions": []}


async def analyze_resume_with_ai(resume_text: str) -> dict:
    """使用 AI 分析简历"""
    if not OPENAI_API_KEY:
        return {"error": "请配置 OPENAI_API_KEY 以启用 AI 分析"}

    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=OPENAI_API_KEY)

    system_prompt = (
        "你是一位资深的技术面试官和职业顾问。请分析以下简历，返回 JSON：\n"
        "{\n"
        '  "highlights": ["简历亮点1", ...],\n'
        '  "questions": [{"category": "分类", "question": "问题", "difficulty": "难度"}, ...],\n'
        '  "improvements": ["改进建议1", ...]\n'
        "}\n"
        "要求：\n"
        "- 生成至少 15 个面试可能问到的问题\n"
        "- 问题覆盖：技术深挖、项目追问、系统设计、行为问题\n"
        "- 难度分为：基础、进阶、深入"
    )

    response = await client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"简历内容：\n{resume_text}"},
        ],
        max_tokens=2000,
        response_format={"type": "json_object"},
    )

    import json
    try:
        return json.loads(response.choices[0].message.content or "{}")
    except json.JSONDecodeError:
        return {"error": "AI 分析结果解析失败"}
