#!/bin/bash
# 一键启动脚本 - 同时启动前端和后端（开发环境）
# 使用方法: ./scripts/dev/start_all.sh

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/../.." && pwd )"

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  AI Service Monitor Pro 一键启动${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 检查Python是否安装
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}错误: 未找到 python3，请先安装 Python 3.8+${NC}"
    exit 1
fi

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo -e "${RED}错误: 未找到 node，请先安装 Node.js 16+${NC}"
    exit 1
fi

# 检查npm是否安装
if ! command -v npm &> /dev/null; then
    echo -e "${RED}错误: 未找到 npm，请先安装 npm${NC}"
    exit 1
fi

# 检查后端依赖
if [ -f "$PROJECT_DIR/backend/requirements.txt" ]; then
    echo -e "${GREEN}检查后端依赖...${NC}"
    if ! python3 -c "import uvicorn" 2>/dev/null; then
        echo -e "${YELLOW}后端依赖未安装，正在安装...${NC}"
        cd "$PROJECT_DIR/backend"
        pip3 install -r requirements.txt
    fi
fi

# 检查前端依赖
if [ -f "$PROJECT_DIR/frontend/package.json" ]; then
    echo -e "${GREEN}检查前端依赖...${NC}"
    if [ ! -d "$PROJECT_DIR/frontend/node_modules" ]; then
        echo -e "${YELLOW}前端依赖未安装，正在安装...${NC}"
        cd "$PROJECT_DIR/frontend"
        npm install
    fi
fi

# 清理函数
cleanup() {
    echo ""
    echo -e "${YELLOW}正在停止服务...${NC}"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    wait $BACKEND_PID $FRONTEND_PID 2>/dev/null
    echo -e "${GREEN}服务已停止${NC}"
    exit 0
}

# 注册清理函数
trap cleanup SIGINT SIGTERM

# 启动后端
echo ""
echo -e "${GREEN}启动后端服务 (端口 8633)...${NC}"
cd "$PROJECT_DIR/backend"
python3 -m uvicorn main:app --host 0.0.0.0 --port 8633 &
BACKEND_PID=$!
cd "$PROJECT_DIR"

# 等待后端启动
sleep 3

# 检查后端是否启动成功
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${RED}后端启动失败！${NC}"
    exit 1
fi

echo -e "${GREEN}后端服务已启动 (PID: $BACKEND_PID)${NC}"

# 启动前端
echo ""
echo -e "${GREEN}启动前端服务 (端口 3456)...${NC}"
cd "$PROJECT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!
cd "$PROJECT_DIR"

# 等待前端启动
sleep 3

# 检查前端是否启动成功
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo -e "${RED}前端启动失败！${NC}"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

echo -e "${GREEN}前端服务已启动 (PID: $FRONTEND_PID)${NC}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  服务启动成功！${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}后端 API: http://localhost:8633${NC}"
echo -e "${GREEN}前端界面: http://localhost:3456${NC}"
echo ""
echo -e "${YELLOW}按 Ctrl+C 停止所有服务${NC}"
echo ""

# 等待进程结束
wait

