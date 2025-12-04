#!/bin/bash
# Linux 一键配置开机自动启动脚本
# 使用方法: sudo ./setup_auto_start_linux.sh

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  AI Service Monitor Pro${NC}"
echo -e "${GREEN}  开机自动启动配置脚本${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 检查是否为root用户
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}错误: 请使用 sudo 运行此脚本${NC}"
    echo -e "${YELLOW}使用方法: sudo ./setup_auto_start_linux.sh${NC}"
    exit 1
fi

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/../.." && pwd )"
BACKEND_DIR="$PROJECT_DIR/backend"

# 检查backend目录是否存在
if [ ! -d "$BACKEND_DIR" ]; then
    echo -e "${RED}错误: 未找到 backend 目录${NC}"
    exit 1
fi

# 检查服务文件模板是否存在
SERVICE_TEMPLATE="$PROJECT_DIR/scripts/prod/ai-service-monitor.service"
if [ ! -f "$SERVICE_TEMPLATE" ]; then
    echo -e "${RED}错误: 未找到服务文件模板: $SERVICE_TEMPLATE${NC}"
    exit 1
fi

# 获取当前用户名（如果从sudo运行，获取SUDO_USER）
if [ -n "$SUDO_USER" ]; then
    RUN_USER="$SUDO_USER"
else
    RUN_USER=$(whoami)
fi

echo -e "${BLUE}当前配置信息:${NC}"
echo -e "  项目目录: ${GREEN}$PROJECT_DIR${NC}"
echo -e "  后端目录: ${GREEN}$BACKEND_DIR${NC}"
echo -e "  运行用户: ${GREEN}$RUN_USER${NC}"
echo ""

# 检测Python路径
echo -e "${YELLOW}正在检测Python路径...${NC}"
PYTHON_PATH=$(which python3)
if [ -z "$PYTHON_PATH" ]; then
    PYTHON_PATH=$(which python)
fi

if [ -z "$PYTHON_PATH" ]; then
    echo -e "${RED}错误: 未找到 Python 解释器${NC}"
    exit 1
fi

echo -e "${GREEN}检测到 Python: $PYTHON_PATH${NC}"

# 检查是否使用conda
CONDA_ENV=""
if command -v conda &> /dev/null; then
    CONDA_ENV=$(conda info --envs | grep '*' | awk '{print $1}' | tr -d '*')
    if [ -n "$CONDA_ENV" ] && [ "$CONDA_ENV" != "base" ]; then
        CONDA_PYTHON=$(conda info --base)/envs/$CONDA_ENV/bin/python
        if [ -f "$CONDA_PYTHON" ]; then
            echo -e "${GREEN}检测到 Conda 环境: $CONDA_ENV${NC}"
            echo -e "${GREEN}Conda Python: $CONDA_PYTHON${NC}"
            read -p "是否使用 Conda 环境? (y/n): " USE_CONDA
            if [[ "$USE_CONDA" =~ ^[Yy]$ ]]; then
                PYTHON_PATH="$CONDA_PYTHON"
            fi
        fi
    fi
fi

echo ""

# 读取服务文件模板
SERVICE_CONTENT=$(cat "$SERVICE_TEMPLATE")

# 替换配置项
SERVICE_CONTENT=$(echo "$SERVICE_CONTENT" | sed "s|User=your_username|User=$RUN_USER|")
SERVICE_CONTENT=$(echo "$SERVICE_CONTENT" | sed "s|WorkingDirectory=/path/to/AI-Service-Monitor-Pro/backend|WorkingDirectory=$BACKEND_DIR|")
SERVICE_CONTENT=$(echo "$SERVICE_CONTENT" | sed "s|ExecStart=/usr/bin/python3|ExecStart=$PYTHON_PATH|")

# 如果使用conda，注释掉系统Python的ExecStart，取消注释conda的
if [[ "$PYTHON_PATH" == *"conda"* ]] || [[ "$PYTHON_PATH" == *"miniconda"* ]]; then
    SERVICE_CONTENT=$(echo "$SERVICE_CONTENT" | sed "s|# ExecStart=/path/to/miniconda3/envs/your_env/bin/python|ExecStart=$PYTHON_PATH|")
    # 注释掉系统Python的ExecStart
    SERVICE_CONTENT=$(echo "$SERVICE_CONTENT" | sed "s|^ExecStart=/usr/bin/python3|# ExecStart=/usr/bin/python3|")
fi

# 写入systemd服务文件
SERVICE_FILE="/etc/systemd/system/ai-service-monitor.service"
echo -e "${YELLOW}正在创建服务文件: $SERVICE_FILE${NC}"
echo "$SERVICE_CONTENT" > "$SERVICE_FILE"

if [ $? -ne 0 ]; then
    echo -e "${RED}错误: 创建服务文件失败${NC}"
    exit 1
fi

echo -e "${GREEN}服务文件创建成功${NC}"
echo ""

# 显示服务文件内容供确认
echo -e "${BLUE}服务文件内容:${NC}"
echo "----------------------------------------"
cat "$SERVICE_FILE"
echo "----------------------------------------"
echo ""

read -p "确认配置正确? (y/n): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}已取消配置${NC}"
    rm -f "$SERVICE_FILE"
    exit 0
fi

# 重新加载systemd配置
echo ""
echo -e "${YELLOW}正在重新加载 systemd 配置...${NC}"
systemctl daemon-reload

if [ $? -ne 0 ]; then
    echo -e "${RED}错误: 重新加载 systemd 配置失败${NC}"
    exit 1
fi

# 启用开机自启
echo -e "${YELLOW}正在启用开机自启...${NC}"
systemctl enable ai-service-monitor.service

if [ $? -ne 0 ]; then
    echo -e "${RED}错误: 启用开机自启失败${NC}"
    exit 1
fi

# 询问是否立即启动服务
echo ""
read -p "是否立即启动服务? (y/n): " START_NOW
if [[ "$START_NOW" =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}正在启动服务...${NC}"
    systemctl start ai-service-monitor.service
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}服务启动成功${NC}"
        sleep 2
        systemctl status ai-service-monitor.service --no-pager
    else
        echo -e "${RED}服务启动失败，请检查日志: journalctl -u ai-service-monitor.service -n 50${NC}"
    fi
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  配置完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}常用命令:${NC}"
echo -e "  启动服务: ${GREEN}sudo systemctl start ai-service-monitor.service${NC}"
echo -e "  停止服务: ${GREEN}sudo systemctl stop ai-service-monitor.service${NC}"
echo -e "  重启服务: ${GREEN}sudo systemctl restart ai-service-monitor.service${NC}"
echo -e "  查看状态: ${GREEN}sudo systemctl status ai-service-monitor.service${NC}"
echo -e "  查看日志: ${GREEN}sudo journalctl -u ai-service-monitor.service -f${NC}"
echo -e "  禁用自启: ${GREEN}sudo systemctl disable ai-service-monitor.service${NC}"
echo ""

