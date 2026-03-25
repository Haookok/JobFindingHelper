# JobFindingHelper — 秋招面试辅助系统

帮助求职者系统复习技术八股文、模拟面试、追踪求职进度的一站式辅助工具。

## 功能模块

- **知识库复习** — 分类整理的技术八股文（Java、Python、前端、算法、数据库、操作系统、计算机网络、系统设计）
- **模拟面试** — AI 驱动的模拟面试，支持多种岗位和难度
- **进度追踪** — 学习进度和薄弱环节可视化
- **简历分析** — 上传简历自动生成高频面试问题

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui |
| 后端 | Python FastAPI + Next.js API Routes |
| 数据库 | SQLite（开发）/ PostgreSQL（生产）via Prisma |
| AI | OpenAI API |

## 快速开始

### 前端

```bash
cd frontend
npm install
npm run dev
```

### 后端

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 环境变量

复制 `.env.example` 到 `.env` 并填入你的 API Key：

```bash
cp .env.example .env
```

## 项目结构

```
JobFindingHelper/
├── frontend/          # Next.js 前端
├── backend/           # FastAPI 后端 + 知识库
├── .cursor/           # Cursor rules & skills
└── README.md
```

## License

MIT
