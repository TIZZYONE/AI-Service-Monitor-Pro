"""
任务管理系统 - FastAPI后端主程序
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn

from api.routes import tasks, logs, websocket
from core.scheduler import TaskScheduler
from core.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时初始化数据库
    await init_db()
    
    # 启动任务调度器
    scheduler = TaskScheduler()
    app.state.scheduler = scheduler
    await scheduler.start()
    
    yield
    
    # 关闭时停止调度器
    await scheduler.stop()


app = FastAPI(
    title="任务管理系统",
    description="一个支持定时任务管理和控制台日志查看的系统",
    version="1.0.0",
    lifespan=lifespan
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3456",
        "http://127.0.0.1:3456",
        "http://0.0.0.0:3456",
        "http://localhost:3457",
        "http://127.0.0.1:3457",
        "http://0.0.0.0:3457",
        "http://localhost:8633",
        "http://127.0.0.1:8633",
        "http://0.0.0.0:8633"
    ], 
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])
app.include_router(logs.router, prefix="/api/logs", tags=["logs"])
app.include_router(websocket.router, prefix="/ws", tags=["websocket"])


@app.get("/")
async def root():
    return {"message": "任务管理系统API"}


@app.get("/health")
async def health_check():
    """健康检查端点，返回系统状态信息"""
    import psutil
    import subprocess
    from datetime import datetime
    
    def get_gpu_memory_info():
        """获取GPU显存信息"""
        try:
            # 执行nvidia-smi命令获取显存信息
            result = subprocess.run([
                'nvidia-smi', 
                '--query-gpu=memory.used,memory.total', 
                '--format=csv,noheader,nounits'
            ], capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                lines = result.stdout.strip().split('\n')
                if lines and lines[0]:
                    # 取第一个GPU的信息
                    memory_info = lines[0].split(', ')
                    if len(memory_info) == 2:
                        used_mb = int(memory_info[0])
                        total_mb = int(memory_info[1])
                        usage_percent = (used_mb / total_mb) * 100
                        return {
                            "gpu_memory_usage": f"{usage_percent:.1f}%",
                            "gpu_memory_total": f"{total_mb // 1024}GB"
                        }
            return {}
        except (subprocess.TimeoutExpired, subprocess.CalledProcessError, FileNotFoundError, ValueError):
            # nvidia-smi不存在或执行失败，返回空字典
            return {}
    
    try:
        # 获取系统资源使用情况
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        # 获取GPU显存信息
        gpu_info = get_gpu_memory_info()
        
        # 构建系统信息
        system_info = {
            "cpu_usage": f"{cpu_percent}%",
            "memory_usage": f"{memory.percent}%",
            "disk_usage": f"{disk.percent}%",
            "memory_total": f"{memory.total // (1024**3)}GB",
            "disk_total": f"{disk.total // (1024**3)}GB"
        }
        
        # 如果有GPU信息，添加到系统信息中
        if gpu_info:
            system_info.update(gpu_info)
        
        return {
            "status": "ok",
            "timestamp": datetime.now().isoformat(),
            "service": "任务管理系统",
            "version": "1.0.0",
            "system": system_info,
            "database": "connected",
            "scheduler": "running" if hasattr(app.state, 'scheduler') else "stopped"
        }
    except Exception as e:
        return {
            "status": "error",
            "timestamp": datetime.now().isoformat(),
            "error": str(e)
        }


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8633,
        reload=True,
        log_level="info"
    )