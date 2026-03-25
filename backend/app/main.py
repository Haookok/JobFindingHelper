from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import knowledge, interview, resume, search


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.services.search_service import build_index
    build_index()
    yield


app = FastAPI(
    title="秋招面试辅助系统 API",
    description="提供知识库查询、全文检索、模拟面试、简历分析等 AI 能力",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(knowledge.router, prefix="/api/knowledge", tags=["知识库"])
app.include_router(search.router, prefix="/api/search", tags=["搜索"])
app.include_router(interview.router, prefix="/api/interview", tags=["模拟面试"])
app.include_router(resume.router, prefix="/api/resume", tags=["简历分析"])


@app.get("/api/health")
async def health_check():
    return {"code": 200, "message": "ok", "data": {"status": "healthy"}}
