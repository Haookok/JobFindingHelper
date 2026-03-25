from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter()

KNOWLEDGE_DIR = Path(__file__).parent.parent / "knowledge"

CATEGORIES = {
    "ai-llm": {"name": "AI / LLM", "description": "Transformer、Attention、大模型原理、RAG、Agent、微调、推理优化", "group": "AI 与算法"},
    "machine-learning": {"name": "机器学习", "description": "损失函数、优化器、经典模型、特征工程、评估指标、深度学习基础", "group": "AI 与算法"},
    "algorithms": {"name": "数据结构与算法", "description": "排序、搜索、动态规划、图算法、贪心、回溯、LeetCode 高频题", "group": "计算机基础"},
    "os": {"name": "操作系统", "description": "进程线程、内存管理、IO 模型、死锁、调度算法", "group": "计算机基础"},
    "network": {"name": "计算机网络", "description": "TCP/IP、HTTP/HTTPS、DNS、WebSocket、网络安全", "group": "计算机基础"},
    "database": {"name": "数据库", "description": "MySQL、Redis、索引优化、事务、锁机制、分库分表", "group": "计算机基础"},
    "java": {"name": "Java", "description": "Java 基础、JVM、并发编程、集合框架、Spring 生态", "group": "后端开发"},
    "python": {"name": "Python", "description": "Python 基础、GIL、装饰器、异步编程、Web 框架", "group": "后端开发"},
    "go": {"name": "Go", "description": "Goroutine、Channel、GC、接口、并发模式、微服务框架", "group": "后端开发"},
    "frontend": {"name": "前端", "description": "JavaScript 核心、React/Vue、浏览器原理、性能优化、工程化", "group": "前端开发"},
    "system-design": {"name": "系统设计", "description": "分布式系统、微服务、消息队列、缓存架构、限流熔断", "group": "架构与工程"},
    "cloud-native": {"name": "云原生", "description": "Docker、Kubernetes、CI/CD、服务网格、可观测性", "group": "架构与工程"},
    "security": {"name": "安全", "description": "Web 安全、认证授权、加密算法、OWASP Top 10", "group": "架构与工程"},
    "project-experience": {"name": "项目经验", "description": "STAR 法则、项目亮点提炼、技术选型论述、难点复盘", "group": "求职软实力"},
    "soft-skills": {"name": "软技能", "description": "自我介绍、反问技巧、薪资谈判、职业规划、沟通表达", "group": "求职软实力"},
}


@router.get("/categories")
async def get_categories():
    """获取所有知识分类及其知识点数量"""
    result = []
    for cat_id, info in CATEGORIES.items():
        cat_dir = KNOWLEDGE_DIR / cat_id
        count = len(list(cat_dir.glob("*.md"))) if cat_dir.exists() else 0
        result.append({
            "id": cat_id,
            "name": info["name"],
            "description": info["description"],
            "group": info.get("group", ""),
            "count": count,
        })
    return {"code": 200, "message": "success", "data": result}


@router.get("/categories/{category_id}")
async def get_category_points(category_id: str):
    """获取某个分类下的所有知识点"""
    if category_id not in CATEGORIES:
        raise HTTPException(status_code=404, detail=f"分类 {category_id} 不存在")

    cat_dir = KNOWLEDGE_DIR / category_id
    if not cat_dir.exists():
        return {"code": 200, "message": "success", "data": []}

    points = []
    for md_file in sorted(cat_dir.glob("*.md")):
        content = md_file.read_text(encoding="utf-8")
        title = content.split("\n")[0].lstrip("# ").strip() if content else md_file.stem
        points.append({
            "id": md_file.stem,
            "title": title,
            "filename": md_file.name,
        })
    return {"code": 200, "message": "success", "data": points}


@router.get("/points/{category_id}/{point_id}")
async def get_knowledge_point(category_id: str, point_id: str):
    """获取具体知识点内容"""
    if category_id not in CATEGORIES:
        raise HTTPException(status_code=404, detail=f"分类 {category_id} 不存在")

    file_path = KNOWLEDGE_DIR / category_id / f"{point_id}.md"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"知识点 {point_id} 不存在")

    content = file_path.read_text(encoding="utf-8")
    return {"code": 200, "message": "success", "data": {"id": point_id, "category": category_id, "content": content}}
