from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import knowledge, interview, resume

app = FastAPI(
    title="秋招面试辅助系统 API",
    description="提供知识库查询、模拟面试、简历分析等 AI 能力",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(knowledge.router, prefix="/api/knowledge", tags=["知识库"])
app.include_router(interview.router, prefix="/api/interview", tags=["模拟面试"])
app.include_router(resume.router, prefix="/api/resume", tags=["简历分析"])


@app.get("/api/health")
async def health_check():
    return {"code": 200, "message": "ok", "data": {"status": "healthy"}}
