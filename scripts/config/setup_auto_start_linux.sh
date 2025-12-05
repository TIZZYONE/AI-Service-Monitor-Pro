#!/bin/bash
# Linux Auto-Start Configuration Script
# Usage: sudo ./setup_auto_start_linux.sh

# Color definitions
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  AI Service Monitor Pro${NC}"
echo -e "${GREEN}  Auto-Start Configuration${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}ERROR: Please run with sudo${NC}"
    echo -e "${YELLOW}Usage: sudo ./setup_auto_start_linux.sh${NC}"
    exit 1
fi

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/../.." && pwd )"
BACKEND_DIR="$PROJECT_DIR/backend"

# Check if backend directory exists
if [ ! -d "$BACKEND_DIR" ]; then
    echo -e "${RED}ERROR: Backend directory not found${NC}"
    exit 1
fi

# Check if service template exists
SERVICE_TEMPLATE="$PROJECT_DIR/scripts/prod/ai-service-monitor.service"
if [ ! -f "$SERVICE_TEMPLATE" ]; then
    echo -e "${RED}ERROR: Service template not found: $SERVICE_TEMPLATE${NC}"
    exit 1
fi

# Get current username (if running from sudo, get SUDO_USER)
if [ -n "$SUDO_USER" ]; then
    RUN_USER="$SUDO_USER"
else
    RUN_USER=$(whoami)
fi

echo -e "${BLUE}Configuration:${NC}"
echo -e "  Project: ${GREEN}$PROJECT_DIR${NC}"
echo -e "  Backend: ${GREEN}$BACKEND_DIR${NC}"
echo -e "  User: ${GREEN}$RUN_USER${NC}"
echo ""

# Detect Python path
echo -e "${YELLOW}Detecting Python path...${NC}"
PYTHON_PATH=$(which python3)
if [ -z "$PYTHON_PATH" ]; then
    PYTHON_PATH=$(which python)
fi

if [ -z "$PYTHON_PATH" ]; then
    echo -e "${RED}ERROR: Python interpreter not found${NC}"
    exit 1
fi

echo -e "${GREEN}Python detected: $PYTHON_PATH${NC}"

# Check if using conda
CONDA_ENV=""
if command -v conda &> /dev/null; then
    CONDA_ENV=$(conda info --envs | grep '*' | awk '{print $1}' | tr -d '*')
    if [ -n "$CONDA_ENV" ] && [ "$CONDA_ENV" != "base" ]; then
        CONDA_PYTHON=$(conda info --base)/envs/$CONDA_ENV/bin/python
        if [ -f "$CONDA_PYTHON" ]; then
            echo -e "${GREEN}Conda environment detected: $CONDA_ENV${NC}"
            echo -e "${GREEN}Conda Python: $CONDA_PYTHON${NC}"
            read -p "Use Conda environment? (y/n): " USE_CONDA
            if [[ "$USE_CONDA" =~ ^[Yy]$ ]]; then
                PYTHON_PATH="$CONDA_PYTHON"
            fi
        fi
    fi
fi

echo ""

# Read service template
SERVICE_CONTENT=$(cat "$SERVICE_TEMPLATE")

# Replace configuration items
SERVICE_CONTENT=$(echo "$SERVICE_CONTENT" | sed "s|User=your_username|User=$RUN_USER|")
SERVICE_CONTENT=$(echo "$SERVICE_CONTENT" | sed "s|WorkingDirectory=/path/to/AI-Service-Monitor-Pro/backend|WorkingDirectory=$BACKEND_DIR|")
SERVICE_CONTENT=$(echo "$SERVICE_CONTENT" | sed "s|ExecStart=/usr/bin/python3|ExecStart=$PYTHON_PATH|")

# If using conda, comment out system Python ExecStart, uncomment conda's
if [[ "$PYTHON_PATH" == *"conda"* ]] || [[ "$PYTHON_PATH" == *"miniconda"* ]]; then
    SERVICE_CONTENT=$(echo "$SERVICE_CONTENT" | sed "s|# ExecStart=/path/to/miniconda3/envs/your_env/bin/python|ExecStart=$PYTHON_PATH|")
    # Comment out system Python ExecStart
    SERVICE_CONTENT=$(echo "$SERVICE_CONTENT" | sed "s|^ExecStart=/usr/bin/python3|# ExecStart=/usr/bin/python3|")
fi

# Write systemd service file
SERVICE_FILE="/etc/systemd/system/ai-service-monitor.service"
echo -e "${YELLOW}Creating service file: $SERVICE_FILE${NC}"
echo "$SERVICE_CONTENT" > "$SERVICE_FILE"

if [ $? -ne 0 ]; then
    echo -e "${RED}ERROR: Failed to create service file${NC}"
    exit 1
fi

echo -e "${GREEN}Service file created successfully${NC}"
echo ""

# Display service file content for confirmation
echo -e "${BLUE}Service file content:${NC}"
echo "----------------------------------------"
cat "$SERVICE_FILE"
echo "----------------------------------------"
echo ""

read -p "Confirm configuration is correct? (y/n): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Configuration cancelled${NC}"
    rm -f "$SERVICE_FILE"
    exit 0
fi

# Reload systemd configuration
echo ""
echo -e "${YELLOW}Reloading systemd configuration...${NC}"
systemctl daemon-reload

if [ $? -ne 0 ]; then
    echo -e "${RED}ERROR: Failed to reload systemd configuration${NC}"
    exit 1
fi

# Enable auto-start on boot
echo -e "${YELLOW}Enabling auto-start on boot...${NC}"
systemctl enable ai-service-monitor.service

if [ $? -ne 0 ]; then
    echo -e "${RED}ERROR: Failed to enable auto-start${NC}"
    exit 1
fi

# Ask to start service now
echo ""
read -p "Start service now? (y/n): " START_NOW
if [[ "$START_NOW" =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Starting service...${NC}"
    systemctl start ai-service-monitor.service
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Service started successfully${NC}"
        sleep 2
        systemctl status ai-service-monitor.service --no-pager
    else
        echo -e "${RED}Service failed to start, check logs: journalctl -u ai-service-monitor.service -n 50${NC}"
    fi
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Configuration Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Common Commands:${NC}"
echo -e "  Start service: ${GREEN}sudo systemctl start ai-service-monitor.service${NC}"
echo -e "  Stop service: ${GREEN}sudo systemctl stop ai-service-monitor.service${NC}"
echo -e "  Restart service: ${GREEN}sudo systemctl restart ai-service-monitor.service${NC}"
echo -e "  View status: ${GREEN}sudo systemctl status ai-service-monitor.service${NC}"
echo -e "  View logs: ${GREEN}sudo journalctl -u ai-service-monitor.service -f${NC}"
echo -e "  Disable auto-start: ${GREEN}sudo systemctl disable ai-service-monitor.service${NC}"
echo ""

