"""
基于 Whoosh + jieba 的中文全文检索服务。
对 knowledge/ 下所有 Markdown 文件建立倒排索引，支持关键词搜索、分类过滤、高亮片段。
"""

import os
import re
from pathlib import Path

from whoosh import index
from whoosh.fields import Schema, TEXT, ID, KEYWORD
from whoosh.qparser import MultifieldParser, OrGroup
from whoosh.highlight import ContextFragmenter, HtmlFormatter
from whoosh.analysis import Tokenizer, Token
import jieba

KNOWLEDGE_DIR = Path(__file__).parent.parent / "knowledge"
INDEX_DIR = Path(__file__).parent.parent / ".search_index"


class JiebaTokenizer(Tokenizer):
    """jieba 中文分词器，兼容 Whoosh Analyzer 接口"""

    def __call__(self, value, positions=False, chars=False, keeporiginal=False,
                 removestops=True, start_pos=0, start_char=0, tokenize=True,
                 mode="", **kwargs):
        t = Token(positions, chars, removestops=removestops, mode=mode)
        pos = start_pos
        for word in jieba.cut_for_search(value):
            stripped = word.strip()
            if not stripped:
                continue
            t.original = t.text = stripped
            t.boost = 1.0
            if positions:
                t.pos = pos
                pos += 1
            if chars:
                t.startchar = value.find(stripped, start_char)
                t.endchar = t.startchar + len(stripped)
                start_char = t.endchar
            yield t


jieba_analyzer = JiebaTokenizer()

SCHEMA = Schema(
    path=ID(stored=True, unique=True),
    category=ID(stored=True),
    category_name=TEXT(stored=True, analyzer=jieba_analyzer),
    title=TEXT(stored=True, analyzer=jieba_analyzer, field_boost=3.0),
    difficulty=ID(stored=True),
    tags=KEYWORD(stored=True, commas=True, scorable=True),
    content=TEXT(stored=True, analyzer=jieba_analyzer),
)


def _parse_metadata(content: str) -> dict:
    """从 Markdown 正文提取元数据行（难度、分类、标签）"""
    meta = {"difficulty": "", "tags": ""}
    for line in content.split("\n")[:10]:
        if line.startswith("- **难度"):
            match = re.search(r":\s*(.+)", line)
            if match:
                meta["difficulty"] = match.group(1).strip().split("|")[0].strip()
        elif line.startswith("- **标签"):
            match = re.search(r"\[(.+)\]", line)
            if match:
                meta["tags"] = match.group(1).strip()
    return meta


def build_index() -> index.Index:
    """扫描知识库目录，创建或重建全文索引"""
    os.makedirs(INDEX_DIR, exist_ok=True)
    ix = index.create_in(str(INDEX_DIR), SCHEMA)
    writer = ix.writer()

    from app.routers.knowledge import CATEGORIES

    for cat_id, info in CATEGORIES.items():
        cat_dir = KNOWLEDGE_DIR / cat_id
        if not cat_dir.exists():
            continue
        for md_file in cat_dir.glob("*.md"):
            content = md_file.read_text(encoding="utf-8")
            title_line = content.split("\n")[0] if content else ""
            title = title_line.lstrip("# ").strip() or md_file.stem
            meta = _parse_metadata(content)

            writer.update_document(
                path=f"{cat_id}/{md_file.stem}",
                category=cat_id,
                category_name=info["name"],
                title=title,
                difficulty=meta["difficulty"],
                tags=meta["tags"],
                content=content,
            )

    writer.commit()
    return ix


def get_index() -> index.Index:
    """获取索引实例；不存在则自动构建"""
    if index.exists_in(str(INDEX_DIR)):
        return index.open_dir(str(INDEX_DIR))
    return build_index()


def search(
    query_str: str,
    category: str | None = None,
    limit: int = 20,
) -> list[dict]:
    """
    全文搜索知识库。
    返回匹配的知识点列表，每项包含标题、分类、高亮片段、相关度评分。
    """
    ix = get_index()

    parser = MultifieldParser(
        ["title", "content", "tags"],
        schema=ix.schema,
        group=OrGroup,
    )
    q = parser.parse(query_str)

    results_list = []
    with ix.searcher() as searcher:
        if category:
            from whoosh.query import Term
            filter_q = Term("category", category)
            results = searcher.search(q, filter=filter_q, limit=limit)
        else:
            results = searcher.search(q, limit=limit)

        results.fragmenter = ContextFragmenter(maxchars=200, surround=60)
        results.formatter = HtmlFormatter(tagname="mark", classname="search-highlight")

        for hit in results:
            highlight = hit.highlights("content", top=3) or ""
            results_list.append({
                "path": hit["path"],
                "category": hit["category"],
                "category_name": hit.get("category_name", ""),
                "title": hit["title"],
                "difficulty": hit.get("difficulty", ""),
                "tags": hit.get("tags", ""),
                "score": round(hit.score, 3),
                "highlight": highlight,
            })

    return results_list
