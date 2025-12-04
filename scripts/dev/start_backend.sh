#!/bin/bash
# 后端启动脚本（开发环境）
# 使用方法: ./scripts/dev/start_backend.sh

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/../.." && pwd )"
BACKEND_DIR="$PROJECT_DIR/backend"
cd "$BACKEND_DIR"

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  启动后端服务${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 检查Python是否安装
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}错误: 未找到 python3，请先安装 Python 3.8+${NC}"
    exit 1
fi

# 检查后端依赖
if [ ! -f "requirements.txt" ]; then
    echo -e "${YELLOW}警告: 未找到 requirements.txt${NC}"
else
    echo -e "${GREEN}检查后端依赖...${NC}"
    if ! python3 -c "import uvicorn" 2>/dev/null; then
        echo -e "${YELLOW}后端依赖未安装，正在安装...${NC}"
        pip3 install -r requirements.txt
    fi
fi

echo ""
echo -e "${GREEN}启动后端服务 (端口 8633)...${NC}"
echo -e "${YELLOW}按 Ctrl+C 停止服务${NC}"
echo ""

# 启动后端
python3 -m uvicorn main:app --host 0.0.0.0 --port 8633

