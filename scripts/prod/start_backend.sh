#!/bin/bash
# Linux/Mac 后端启动脚本（生产环境）
# 使用方法：将此脚本添加到系统启动项（systemd）

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/../.." && pwd )"
BACKEND_DIR="$PROJECT_DIR/backend"
cd "$BACKEND_DIR"

# 激活conda环境（如果使用conda，取消下面的注释并修改路径）
# source ~/miniconda3/etc/profile.d/conda.sh
# conda activate your_env_name

# 或者使用python虚拟环境（如果使用，取消下面的注释）
# source venv/bin/activate

# 启动后端服务（生产环境）
python3 -m uvicorn main:app --host 0.0.0.0 --port 8633

