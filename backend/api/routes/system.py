"""
系统操作相关的API路由（关机、重启等）
"""
import platform
import subprocess
import logging
from fastapi import APIRouter, HTTPException, status
from typing import Dict

logger = logging.getLogger(__name__)

router = APIRouter()


def shutdown_system() -> Dict[str, str]:
    """
    关机系统（适配Linux、Windows、Mac）
    返回执行结果
    """
    system = platform.system().lower()
    
    try:
        if system == "linux" or system.startswith("linux"):
            # Linux系统：使用shutdown命令
            # -h: halt (关机)
            # +0: 立即执行
            subprocess.run(["shutdown", "-h", "now"], check=True, timeout=5)
            return {"success": True, "message": "系统正在关机..."}
        
        elif system == "darwin":
            # macOS系统：使用shutdown命令
            subprocess.run(["shutdown", "-h", "now"], check=True, timeout=5)
            return {"success": True, "message": "系统正在关机..."}
        
        elif system == "windows":
            # Windows系统：使用shutdown命令
            # /s: 关机
            # /t 0: 延迟0秒
            subprocess.run(["shutdown", "/s", "/t", "0"], check=True, timeout=5)
            return {"success": True, "message": "系统正在关机..."}
        
        else:
            return {
                "success": False,
                "message": f"不支持的操作系统: {system}"
            }
    
    except subprocess.TimeoutExpired:
        # 命令执行超时（可能已经开始关机）
        return {"success": True, "message": "关机命令已执行，系统正在关机..."}
    
    except subprocess.CalledProcessError as e:
        logger.error(f"关机命令执行失败: {e}")
        return {
            "success": False,
            "message": f"关机命令执行失败: {str(e)}"
        }
    
    except Exception as e:
        logger.error(f"关机操作出错: {e}")
        return {
            "success": False,
            "message": f"关机操作出错: {str(e)}"
        }


@router.post("/shutdown", status_code=status.HTTP_200_OK)
async def shutdown_server():
    """
    服务器关机
    先停止所有运行的任务，然后执行关机
    """
    from main import app
    
    try:
        # 先停止所有运行的任务
        scheduler = app.state.scheduler
        stop_result = await scheduler.stop_all_tasks()
        
        logger.info(f"关机前停止任务结果: {stop_result}")
        
        # 执行关机
        shutdown_result = shutdown_system()
        
        return {
            "success": shutdown_result["success"],
            "message": shutdown_result["message"],
            "tasks_stopped": stop_result
        }
    
    except Exception as e:
        logger.error(f"关机操作失败: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"关机操作失败: {str(e)}"
        )

