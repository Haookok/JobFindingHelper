#!/bin/bash

# 秋招面试辅助系统 — 一键启动脚本
# 用法: ./start.sh

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

cleanup() {
    echo ""
    echo -e "${YELLOW}正在关闭服务...${NC}"
    if [ -n "$BACKEND_PID" ]; then
        kill "$BACKEND_PID" 2>/dev/null && echo -e "${GREEN}后端已关闭${NC}"
    fi
    if [ -n "$FRONTEND_PID" ]; then
        kill "$FRONTEND_PID" 2>/dev/null && echo -e "${GREEN}前端已关闭${NC}"
    fi
    exit 0
}

trap cleanup SIGINT SIGTERM

echo "================================================"
echo "  秋招面试辅助系统 — JobFindingHelper"
echo "================================================"
echo ""

# ---------- 后端环境检查 ----------
echo -e "${YELLOW}[1/4] 检查后端环境...${NC}"

if [ ! -d "$BACKEND_DIR/.venv" ]; then
    echo "  创建 Python 虚拟环境..."
    PYTHON_BIN=""
    for p in python3.11 python3.12 python3.10 python3; do
        if command -v "$p" &>/dev/null; then
            PYTHON_BIN="$p"
            break
        fi
    done
    if [ -z "$PYTHON_BIN" ]; then
        echo -e "${RED}错误: 找不到 Python 3.10+，请先安装${NC}"
        exit 1
    fi
    "$PYTHON_BIN" -m venv "$BACKEND_DIR/.venv"
fi

source "$BACKEND_DIR/.venv/bin/activate"

echo "  安装/更新后端依赖..."
pip install -q -r "$BACKEND_DIR/requirements.txt"

echo -e "${GREEN}  后端环境就绪${NC}"

# ---------- 前端环境检查 ----------
echo -e "${YELLOW}[2/4] 检查前端环境...${NC}"

if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo "  安装前端依赖（首次可能需要几分钟）..."
    cd "$FRONTEND_DIR" && npm install
fi

echo -e "${GREEN}  前端环境就绪${NC}"

# ---------- 启动后端 ----------
echo -e "${YELLOW}[3/4] 启动后端 API 服务 (端口 8000)...${NC}"

cd "$BACKEND_DIR"
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!

sleep 3

if kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo -e "${GREEN}  后端已启动: http://localhost:8000${NC}"
    echo -e "${GREEN}  API 文档:   http://localhost:8000/docs${NC}"
else
    echo -e "${RED}  后端启动失败${NC}"
    exit 1
fi

# ---------- 启动前端 ----------
echo -e "${YELLOW}[4/4] 启动前端 Web 服务 (端口 3000)...${NC}"

cd "$FRONTEND_DIR"
npm run dev &
FRONTEND_PID=$!

sleep 4

echo ""
echo "================================================"
echo -e "${GREEN}  全部服务已启动!${NC}"
echo ""
echo "  前端页面:  http://localhost:3000"
echo "  后端 API:  http://localhost:8000"
echo "  API 文档:  http://localhost:8000/docs"
echo "  搜索示例:  http://localhost:3000/search?q=Transformer"
echo ""
echo "  按 Ctrl+C 停止所有服务"
echo "================================================"

wait
