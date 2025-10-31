"""
WebSocket路由 - 实时日志查看
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.ext.asyncio import AsyncSession
import asyncio
import os
import json
from typing import Dict, Set

from core.database import get_db, AsyncSessionLocal
from services.task_service import TaskService
from services.log_service import LogService

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
                
                # 发送现有日志内容
                if os.path.exists(log_file_path):
                    try:
                        with open(log_file_path, 'r', encoding='utf-8') as f:
                            content = f.read()
                            if content:
                                await websocket.send_text(json.dumps({
                                    "type": "initial_log",
                                    "content": content
                                }))
                    except Exception as e:
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "message": f"读取日志文件失败: {str(e)}"
                        }))
                
                # 监控日志文件变化
                last_size = os.path.getsize(log_file_path) if os.path.exists(log_file_path) else 0
                
                while True:
                    await asyncio.sleep(3)  # 每秒检查一次
                    
                    if os.path.exists(log_file_path):
                        current_size = os.path.getsize(log_file_path)
                        if current_size > last_size:
                            # 文件有新内容
                            try:
                                with open(log_file_path, 'r', encoding='utf-8') as f:
                                    f.seek(last_size)
                                    new_content = f.read()
                                    if new_content:
                                        await websocket.send_text(json.dumps({
                                            "type": "log_update",
                                            "content": new_content
                                        }))
                                last_size = current_size
                            except Exception as e:
                                await websocket.send_text(json.dumps({
                                    "type": "error",
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
                "message": f"WebSocket错误: {str(e)}"
            }))
        except:
            pass
        manager.disconnect(websocket, task_id)