from fastapi import APIRouter

from app.models.schemas import ResumeAnalyzeRequest

router = APIRouter()


@router.post("/analyze")
async def analyze_resume(req: ResumeAnalyzeRequest):
    """分析简历，生成面试问题和改进建议"""
    resume_text = req.resume_text

    lines = [line.strip() for line in resume_text.split("\n") if line.strip()]
    tech_keywords = [
        "Java", "Python", "Go", "C++", "JavaScript", "TypeScript",
        "React", "Vue", "Spring", "Django", "FastAPI", "MySQL",
        "Redis", "Kafka", "Docker", "Kubernetes", "AWS", "分布式",
        "微服务", "机器学习", "深度学习",
    ]
    found_techs = [kw for kw in tech_keywords if kw.lower() in resume_text.lower()]

    questions = []
    for tech in found_techs[:5]:
        questions.append({
            "category": "技术深挖",
            "question": f"请详细介绍你在项目中使用 {tech} 的经验，遇到了哪些挑战？",
            "difficulty": "进阶",
        })

    questions.extend([
        {"category": "项目经历", "question": "请介绍你最有挑战性的一个项目，你在其中扮演什么角色？", "difficulty": "基础"},
        {"category": "项目经历", "question": "项目中遇到的最大的技术难题是什么？你是如何解决的？", "difficulty": "进阶"},
        {"category": "自我认知", "question": "你觉得自己最大的技术优势和需要提升的方面分别是什么？", "difficulty": "基础"},
    ])

    return {
        "code": 200,
        "message": "success",
        "data": {
            "highlights": [f"掌握 {tech} 技术" for tech in found_techs[:3]] or ["简历内容较为丰富"],
            "questions": questions,
            "improvements": [
                "建议量化项目成果（如性能提升百分比、用户增长数据）",
                "技术栈描述可以更具体（版本号、使用场景）",
                "项目经历建议使用 STAR 法则组织",
            ],
            "detected_techs": found_techs,
            "resume_lines": len(lines),
        },
    }
