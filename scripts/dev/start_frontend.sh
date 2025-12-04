#!/bin/bash
# 前端启动脚本（开发环境）
# 使用方法: ./scripts/dev/start_frontend.sh

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/../.." && pwd )"
FRONTEND_DIR="$PROJECT_DIR/frontend"
cd "$FRONTEND_DIR"

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  启动前端服务${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

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

# 检查前端依赖
if [ ! -f "package.json" ]; then
    echo -e "${RED}错误: 未找到 package.json${NC}"
    exit 1
fi

echo -e "${GREEN}检查前端依赖...${NC}"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}前端依赖未安装，正在安装...${NC}"
    npm install
fi

echo ""
echo -e "${GREEN}启动前端服务 (端口 3456)...${NC}"
echo -e "${YELLOW}按 Ctrl+C 停止服务${NC}"
echo ""

# 启动前端
npm run dev

