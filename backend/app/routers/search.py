from fastapi import APIRouter, Query

from app.services.search_service import search, build_index

router = APIRouter()


@router.get("/query")
async def search_knowledge(
    q: str = Query(..., min_length=1, description="搜索关键词"),
    category: str | None = Query(None, description="限定分类（可选）"),
    limit: int = Query(20, ge=1, le=50, description="最大返回条数"),
):
    """全文搜索知识库"""
    results = search(query_str=q, category=category, limit=limit)
    return {
        "code": 200,
        "message": "success",
        "data": {
            "query": q,
            "total": len(results),
            "results": results,
        },
    }


@router.post("/reindex")
async def reindex():
    """重建搜索索引（知识库内容变更后调用）"""
    ix = build_index()
    return {
        "code": 200,
        "message": "success",
        "data": {"doc_count": ix.doc_count()},
    }
