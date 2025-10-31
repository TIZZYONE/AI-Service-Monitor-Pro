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
        """获取GPU显存信息（支持多卡），返回汇总与逐卡数据"""
        try:
            # 查询多卡显存与利用率信息
            result = subprocess.run([
                'nvidia-smi',
                '--query-gpu=index,name,memory.used,memory.total,utilization.gpu',
                '--format=csv,noheader,nounits'
            ], capture_output=True, text=True, timeout=10)

            if result.returncode != 0:
                return {}

            lines = [ln.strip() for ln in result.stdout.strip().split('\n') if ln.strip()]
            if not lines:
                return {}

            cards = []
            total_mb = 0
            used_mb = 0
            for ln in lines:
                parts = [p.strip() for p in ln.split(',')]
                # 期望: index, name, used(MB), total(MB), utilization(%)
                if len(parts) < 5:
                    # 兼容部分环境输出带空格分隔
                    parts = [p.strip() for p in ln.split(', ')]
                if len(parts) >= 5:
                    try:
                        idx = int(parts[0])
                        name = parts[1]
                        used = int(parts[2])
                        total = int(parts[3])
                        util = float(parts[4])
                    except ValueError:
                        # 输出格式异常时跳过该行
                        continue

                    percent = (used / total) * 100 if total > 0 else 0.0
                    cards.append({
                        "index": idx,
                        "name": name,
                        "memory_used_mb": used,
                        "memory_total_mb": total,
                        "percent": round(percent, 1),
                        "utilization_percent": round(util, 1),
                    })
                    total_mb += total
                    used_mb += used

            if not cards:
                return {}

            usage_percent = (used_mb / total_mb) * 100 if total_mb > 0 else 0.0
            return {
                # 汇总（保持原有字段以兼容前端）
                "gpu_memory_usage": f"{usage_percent:.1f}%",
                "gpu_memory_total": f"{total_mb // 1024}GB",
                # 逐卡数据
                "gpus": cards,
                # 平均利用率（简单平均）
                "gpu_percent_avg": round(sum(c.get("percent", 0) for c in cards) / len(cards), 1)
            }
        except (subprocess.TimeoutExpired, subprocess.CalledProcessError, FileNotFoundError):
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