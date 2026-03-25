import uuid

from fastapi import APIRouter

from app.models.schemas import InterviewStartRequest, InterviewAnswerRequest

router = APIRouter()

sessions: dict[str, dict] = {}


@router.post("/start")
async def start_interview(req: InterviewStartRequest):
    """开始一场模拟面试"""
    session_id = str(uuid.uuid4())
    sessions[session_id] = {
        "id": session_id,
        "position": req.position,
        "difficulty": req.difficulty,
        "company": req.company,
        "stage": "自我介绍",
        "question_index": 0,
        "questions": [],
        "answers": [],
        "scores": [],
    }

    first_question = "请简单介绍一下你自己，包括你的技术栈、项目经历和求职方向。"
    sessions[session_id]["questions"].append(first_question)

    return {
        "code": 200,
        "message": "success",
        "data": {
            "session_id": session_id,
            "position": req.position,
            "difficulty": req.difficulty,
            "current_stage": "自我介绍",
            "current_question": first_question,
            "question_index": 0,
        },
    }


@router.post("/answer")
async def submit_answer(req: InterviewAnswerRequest):
    """提交面试回答"""
    session = sessions.get(req.session_id)
    if not session:
        return {"code": 404, "message": "面试会话不存在", "data": None}

    session["answers"].append(req.answer)

    next_index = req.question_index + 1
    if next_index >= 5:
        return {
            "code": 200,
            "message": "success",
            "data": {
                "finished": True,
                "message": "面试结束，正在生成评估报告...",
                "session_id": req.session_id,
            },
        }

    stages = ["自我介绍", "项目经历", "八股文", "算法", "反问环节"]
    next_stage = stages[min(next_index, len(stages) - 1)]
    next_question = f"[{next_stage}] 请等待 AI 面试官生成下一个问题..."

    session["stage"] = next_stage
    session["question_index"] = next_index
    session["questions"].append(next_question)

    return {
        "code": 200,
        "message": "success",
        "data": {
            "finished": False,
            "current_stage": next_stage,
            "current_question": next_question,
            "question_index": next_index,
        },
    }


@router.get("/session/{session_id}")
async def get_session(session_id: str):
    """获取面试会话详情"""
    session = sessions.get(session_id)
    if not session:
        return {"code": 404, "message": "面试会话不存在", "data": None}
    return {"code": 200, "message": "success", "data": session}
