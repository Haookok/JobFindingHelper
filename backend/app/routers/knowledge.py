from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter()

KNOWLEDGE_DIR = Path(__file__).parent.parent / "knowledge"

CATEGORIES = {
    "java": {"name": "Java", "description": "Java 基础、JVM、并发编程、集合框架、Spring"},
    "python": {"name": "Python", "description": "Python 基础、GIL、装饰器、异步编程、Web 框架"},
    "frontend": {"name": "前端", "description": "HTML/CSS/JS、React、浏览器原理、性能优化"},
    "algorithms": {"name": "算法", "description": "排序、搜索、动态规划、图算法、常见题型"},
    "database": {"name": "数据库", "description": "MySQL、Redis、索引优化、事务、分库分表"},
    "os": {"name": "操作系统", "description": "进程线程、内存管理、IO 模型、死锁"},
    "network": {"name": "计算机网络", "description": "TCP/IP、HTTP/HTTPS、DNS、网络安全"},
    "system-design": {"name": "系统设计", "description": "分布式系统、微服务、消息队列、缓存架构"},
}


@router.get("/categories")
async def get_categories():
    """获取所有知识分类及其知识点数量"""
    result = []
    for cat_id, info in CATEGORIES.items():
        cat_dir = KNOWLEDGE_DIR / cat_id
        count = len(list(cat_dir.glob("*.md"))) if cat_dir.exists() else 0
        result.append({"id": cat_id, "name": info["name"], "description": info["description"], "count": count})
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
