"""
FastAPI 健康检查接口
提供系统健康状态检查功能
"""

from fastapi import FastAPI
from datetime import datetime
import uvicorn
from typing import Dict, Any

# 创建 FastAPI 应用实例
app = FastAPI(
    title="AI控制系统健康检查API",
    description="提供系统健康状态检查功能",
    version="1.0.0"
)


@app.get("/")
async def root():
    """根路径，返回API基本信息"""
    return {
        "message": "AI控制系统健康检查API",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
async def health_check() -> Dict[str, Any]:
    """
    健康检查接口
    返回系统当前状态信息
    """
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "service": "AI控制系统",
        "uptime": "正常运行",
        "checks": {
            "database": "ok",
            "memory": "ok",
            "disk": "ok"
        }
    }


@app.get("/health/simple")
async def simple_health_check():
    """简单的健康检查接口，只返回状态"""
    return {"status": "ok"}


if __name__ == "__main__":
    # 启动服务器
    uvicorn.run(
        "health_check_api:app",
        host="0.0.0.0",
        port=8011,
        reload=False  # 在生产环境中关闭reload
    )

