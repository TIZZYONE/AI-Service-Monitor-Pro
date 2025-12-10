"""
WebSocket路由 - 实时日志查看
"""
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.ext.asyncio import AsyncSession
import asyncio
import os
import json
from typing import Dict, Set

from core.database import get_db, AsyncSessionLocal
from services.task_service import TaskService
from services.log_service import LogService

logger = logging.getLogger(__name__)

# WebSocket日志读取限制配置
MAX_WEBSOCKET_LINES = 10000  # WebSocket初始读取最大行数
MAX_FILE_SIZE_MB = 10  # 最大文件大小（MB），超过此大小将只读取最后部分

router = APIRouter()

# 存储WebSocket连接
active_connections: Dict[int, Set[WebSocket]] = {}


class ConnectionManager:
    """WebSocket连接管理器"""
    
    def __init__(self):
        self.active_connections: Dict[int, Set[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, task_id: int):
        """连接WebSocket"""
        await websocket.accept()
        if task_id not in self.active_connections:
            self.active_connections[task_id] = set()
        self.active_connections[task_id].add(websocket)
    
    def disconnect(self, websocket: WebSocket, task_id: int):
        """断开WebSocket连接"""
        if task_id in self.active_connections:
            self.active_connections[task_id].discard(websocket)
            if not self.active_connections[task_id]:
                del self.active_connections[task_id]
    
    async def send_to_task_watchers(self, task_id: int, message: str):
        """向观看特定任务的所有客户端发送消息"""
        if task_id in self.active_connections:
            disconnected = set()
            for websocket in self.active_connections[task_id]:
                try:
                    await websocket.send_text(message)
                except:
                    disconnected.add(websocket)
            
            # 清理断开的连接
            for websocket in disconnected:
                self.active_connections[task_id].discard(websocket)


manager = ConnectionManager()


@router.websocket("/logs/{task_id}")
async def websocket_logs(websocket: WebSocket, task_id: int):
    """实时日志WebSocket端点"""
    await manager.connect(websocket, task_id)
    
    try:
        # 获取数据库会话
        async with AsyncSessionLocal() as db:
            task_service = TaskService(db)
            log_service = LogService(db)
            
            # 检查任务是否存在
            task = await task_service.get_task(task_id)
            if not task:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "task_id": task_id,
                    "message": "任务不存在"
                }))
                return
            
            # 发送初始状态
            await websocket.send_text(json.dumps({
                "type": "status_update",
                "task_id": task_id,
                "task_name": task.name,
                "status": task.status.value
            }))
            
            # 获取最新日志文件
            logs = await log_service.get_task_logs(task_id)
            if logs:
                latest_log = logs[0]
                log_file_path = latest_log.log_file_path
                
                # 发送现有日志内容（限制大小，防止内存溢出）
                if os.path.exists(log_file_path):
                    try:
                        # 检查文件大小
                        file_size = os.path.getsize(log_file_path)
                        file_size_mb = file_size / (1024 * 1024)
                        
                        # 如果文件过大，使用log_service的方法读取（有限制）
                        if file_size_mb > MAX_FILE_SIZE_MB:
                            logger.warning(f"任务 {task_id} 日志文件过大 ({file_size_mb:.2f}MB)，只读取最后 {MAX_WEBSOCKET_LINES} 行")
                            content, total_lines = await log_service.get_log_content(log_file_path, MAX_WEBSOCKET_LINES)
                            if content:
                                await websocket.send_text(json.dumps({
                                    "type": "initial_log",
                                    "task_id": task_id,
                                    "content": content,
                                    "truncated": True,
                                    "total_lines": total_lines,
                                    "message": f"日志文件过大，只显示最后 {MAX_WEBSOCKET_LINES} 行（共 {total_lines} 行）"
                                }))
                        else:
                            # 文件大小正常，读取全部内容
                            content, total_lines = await log_service.get_log_content(log_file_path, MAX_WEBSOCKET_LINES)
                            if content:
                                await websocket.send_text(json.dumps({
                                    "type": "initial_log",
                                    "task_id": task_id,
                                    "content": content,
                                    "truncated": total_lines > MAX_WEBSOCKET_LINES,
                                    "total_lines": total_lines
                                }))
                    except Exception as e:
                        logger.error(f"读取任务 {task_id} 日志文件失败: {str(e)}")
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "task_id": task_id,
                            "message": f"读取日志文件失败: {str(e)}"
                        }))
                
                # 监控日志文件变化
                last_size = os.path.getsize(log_file_path) if os.path.exists(log_file_path) else 0
                
                while True:
                    await asyncio.sleep(3)  # 每3秒检查一次
                    
                    # 检查是否有新的日志文件（日志轮转）
                    current_logs = await log_service.get_task_logs(task_id)
                    if current_logs:
                        current_latest_log = current_logs[0]
                        current_log_path = current_latest_log.log_file_path
                        
                        # 如果日志文件路径改变了，说明发生了轮转
                        if current_log_path != log_file_path:
                            logger.info(f"WebSocket检测到任务 {task_id} 日志文件轮转：{log_file_path} -> {current_log_path}")
                            
                            # 发送轮转通知
                            await websocket.send_text(json.dumps({
                                "type": "log_file_rotated",
                                "task_id": task_id,
                                "old_file": log_file_path,
                                "new_file": current_log_path,
                                "message": f"日志文件已轮转到：{os.path.basename(current_log_path)}"
                            }))
                            
                            # 切换到新日志文件
                            log_file_path = current_log_path
                            last_size = 0  # 重置文件大小，从头开始读取新文件
                            
                            # 发送新文件的初始内容（限制大小）
                            if os.path.exists(log_file_path):
                                try:
                                    # 检查文件大小
                                    file_size = os.path.getsize(log_file_path)
                                    file_size_mb = file_size / (1024 * 1024)
                                    
                                    # 如果文件过大，使用log_service的方法读取（有限制）
                                    if file_size_mb > MAX_FILE_SIZE_MB:
                                        logger.warning(f"任务 {task_id} 新日志文件过大 ({file_size_mb:.2f}MB)，只读取最后 {MAX_WEBSOCKET_LINES} 行")
                                        content, total_lines = await log_service.get_log_content(log_file_path, MAX_WEBSOCKET_LINES)
                                        if content:
                                            await websocket.send_text(json.dumps({
                                                "type": "initial_log",
                                                "task_id": task_id,
                                                "content": content,
                                                "truncated": True,
                                                "total_lines": total_lines,
                                                "message": f"日志文件过大，只显示最后 {MAX_WEBSOCKET_LINES} 行（共 {total_lines} 行）"
                                            }))
                                    else:
                                        # 文件大小正常，读取全部内容（但限制行数）
                                        content, total_lines = await log_service.get_log_content(log_file_path, MAX_WEBSOCKET_LINES)
                                        if content:
                                            await websocket.send_text(json.dumps({
                                                "type": "initial_log",
                                                "task_id": task_id,
                                                "content": content,
                                                "truncated": total_lines > MAX_WEBSOCKET_LINES,
                                                "total_lines": total_lines
                                            }))
                                    last_size = os.path.getsize(log_file_path)
                                except Exception as e:
                                    logger.error(f"读取任务 {task_id} 新日志文件失败: {str(e)}")
                                    await websocket.send_text(json.dumps({
                                        "type": "error",
                                        "task_id": task_id,
                                        "message": f"读取新日志文件失败: {str(e)}"
                                    }))
                    
                    # 监控当前日志文件的变化
                    if os.path.exists(log_file_path):
                        current_size = os.path.getsize(log_file_path)
                        if current_size > last_size:
                            # 文件有新内容
                            try:
                                # 检查增量大小，如果增量过大（超过1MB），限制读取
                                increment_size = current_size - last_size
                                increment_size_mb = increment_size / (1024 * 1024)
                                
                                if increment_size_mb > 1.0:  # 增量超过1MB
                                    logger.warning(f"任务 {task_id} 日志增量过大 ({increment_size_mb:.2f}MB)，限制读取")
                                    # 只读取最后部分（约1000行，假设每行100字符）
                                    read_size = min(100 * 1024, increment_size)  # 最多读取100KB
                                    with open(log_file_path, 'r', encoding='utf-8', errors='ignore') as f:
                                        f.seek(max(0, current_size - read_size))
                                        new_content = f.read()
                                        if new_content:
                                            # 跳过可能不完整的首行
                                            first_newline = new_content.find('\n')
                                            if first_newline > 0:
                                                new_content = new_content[first_newline + 1:]
                                            await websocket.send_text(json.dumps({
                                                "type": "log_update",
                                                "task_id": task_id,
                                                "content": new_content,
                                                "truncated": True,
                                                "message": "日志增量过大，只显示最新部分"
                                            }))
                                else:
                                    # 增量正常，正常读取
                                    with open(log_file_path, 'r', encoding='utf-8', errors='ignore') as f:
                                        f.seek(last_size)
                                        new_content = f.read()
                                        if new_content:
                                            await websocket.send_text(json.dumps({
                                                "type": "log_update",
                                                "task_id": task_id,
                                                "content": new_content
                                            }))
                                last_size = current_size
                            except Exception as e:
                                logger.error(f"读取任务 {task_id} 新日志内容失败: {str(e)}")
                                await websocket.send_text(json.dumps({
                                    "type": "error",
                                    "task_id": task_id,
                                    "message": f"读取新日志内容失败: {str(e)}"
                                }))
                    
                    # 检查任务状态变化
                    updated_task = await task_service.get_task(task_id)
                    if updated_task and updated_task.status != task.status:
                        task = updated_task
                        await websocket.send_text(json.dumps({
                            "type": "status_update",
                            "task_id": task_id,
                            "task_name": task.name,
                            "status": task.status.value
                        }))
            else:
                # 没有日志文件，只监控状态变化
                while True:
                    await asyncio.sleep(2)
                    updated_task = await task_service.get_task(task_id)
                    if updated_task and updated_task.status != task.status:
                        task = updated_task
                        await websocket.send_text(json.dumps({
                            "type": "status_update",
                            "task_id": task_id,
                            "task_name": task.name,
                            "status": task.status.value
                        }))
                        
                        # 如果任务开始运行，重新获取日志文件
                        if task.status.value == "running":
                            logs = await log_service.get_task_logs(task_id)
                            if logs:
                                break
    
    except WebSocketDisconnect:
        manager.disconnect(websocket, task_id)
    except Exception as e:
        try:
            await websocket.send_text(json.dumps({
                "type": "error",
                "task_id": task_id,
                "message": f"WebSocket错误: {str(e)}"
            }))
        except:
            pass
        manager.disconnect(websocket, task_id)