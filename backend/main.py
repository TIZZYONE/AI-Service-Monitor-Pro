"""
任务管理系统 - FastAPI后端主程序
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn

from api.routes import tasks, logs, websocket, system, files, config
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
        "http://172.17.103.72:3456",
        "http://10.2.3.61:3456",
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
app.include_router(system.router, prefix="/api/system", tags=["system"])
app.include_router(files.router, prefix="/api/files", tags=["files"])
app.include_router(config.router, prefix="/api/config", tags=["config"])


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
            # 查询多卡详细信息：索引、名称、显存、利用率、温度、功耗、驱动版本、显存频率、核心频率
            result = subprocess.run([
                'nvidia-smi',
                '--query-gpu=index,name,memory.used,memory.total,utilization.gpu,temperature.gpu,power.draw,driver_version,clocks.mem,clocks.gr',
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
            driver_version = None
            
            for ln in lines:
                parts = [p.strip() for p in ln.split(',')]
                # 期望: index, name, used(MB), total(MB), utilization(%), temperature(°C), power(W), driver_version, mem_clock(MHz), gr_clock(MHz)
                if len(parts) < 5:
                    # 兼容部分环境输出带空格分隔
                    parts = [p.strip() for p in ln.split(', ')]
                
                # 至少需要5个字段（index, name, used, total, utilization）
                if len(parts) >= 5:
                    try:
                        idx = int(parts[0])
                        name = parts[1]
                        used = int(parts[2])
                        total = int(parts[3])
                        util = float(parts[4])
                        
                        # 可选字段
                        temperature = None
                        power_draw = None
                        driver_ver = None
                        mem_clock = None
                        gr_clock = None
                        
                        if len(parts) >= 6 and parts[5]:
                            try:
                                temperature = float(parts[5])
                            except:
                                pass
                        
                        if len(parts) >= 7 and parts[6]:
                            try:
                                power_draw = float(parts[6])
                            except:
                                pass
                        
                        if len(parts) >= 8 and parts[7]:
                            driver_ver = parts[7]
                            if not driver_version:  # 保存第一个驱动版本（通常所有卡相同）
                                driver_version = driver_ver
                        
                        if len(parts) >= 9 and parts[8]:
                            try:
                                mem_clock = float(parts[8])
                            except:
                                pass
                        
                        if len(parts) >= 10 and parts[9]:
                            try:
                                gr_clock = float(parts[9])
                            except:
                                pass

                        percent = (used / total) * 100 if total > 0 else 0.0
                        card_info = {
                            "index": idx,
                            "name": name,
                            "memory_used_mb": used,
                            "memory_total_mb": total,
                            "percent": round(percent, 1),
                            "utilization_percent": round(util, 1),
                        }
                        
                        # 添加可选字段
                        if temperature is not None:
                            card_info["temperature_celsius"] = round(temperature, 1)
                        if power_draw is not None:
                            card_info["power_draw_watts"] = round(power_draw, 1)
                        if driver_ver:
                            card_info["driver_version"] = driver_ver
                        if mem_clock is not None:
                            card_info["memory_clock_mhz"] = round(mem_clock, 1)
                        if gr_clock is not None:
                            card_info["graphics_clock_mhz"] = round(gr_clock, 1)
                        
                        cards.append(card_info)
                        total_mb += total
                        used_mb += used
                    except ValueError as e:
                        # 输出格式异常时跳过该行
                        continue

            if not cards:
                return {}

            usage_percent = (used_mb / total_mb) * 100 if total_mb > 0 else 0.0
            result = {
                # 汇总（保持原有字段以兼容前端）
                "gpu_memory_usage": f"{usage_percent:.1f}%",
                "gpu_memory_total": f"{total_mb // 1024}GB",
                # 逐卡数据
                "gpus": cards,
                # 平均利用率（简单平均）
                "gpu_percent_avg": round(sum(c.get("percent", 0) for c in cards) / len(cards), 1)
            }
            
            # 添加驱动版本信息（如果可用）
            if driver_version:
                result["gpu_driver_version"] = driver_version
            
            return result
        except (subprocess.TimeoutExpired, subprocess.CalledProcessError, FileNotFoundError):
            # nvidia-smi不存在或执行失败，返回空字典
            return {}

    try:
        # 获取系统资源使用情况
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        # 获取CPU详细信息
        cpu_count_physical = psutil.cpu_count(logical=False)  # 物理核心数
        cpu_count_logical = psutil.cpu_count(logical=True)    # 逻辑核心数
        cpu_freq = psutil.cpu_freq()
        cpu_freq_current = cpu_freq.current if cpu_freq else None
        cpu_freq_max = cpu_freq.max if cpu_freq else None

        # 获取GPU显存信息
        gpu_info = get_gpu_memory_info()

        # 构建系统信息
        system_info = {
            "cpu_usage": f"{cpu_percent}%",
            "cpu_count_physical": cpu_count_physical,
            "cpu_count_logical": cpu_count_logical,
            "cpu_freq_current_mhz": round(cpu_freq_current, 2) if cpu_freq_current else None,
            "cpu_freq_max_mhz": round(cpu_freq_max, 2) if cpu_freq_max else None,
            "memory_usage": f"{memory.percent}%",
            "disk_usage": f"{disk.percent}%",
            "memory_total": f"{memory.total // (1024 ** 3)}GB",
            "disk_total": f"{disk.total // (1024 ** 3)}GB"
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
        # reload=True,
        log_level="info"
    )
