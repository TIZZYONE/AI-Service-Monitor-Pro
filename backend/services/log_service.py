"""
日志服务层
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from typing import List, Optional
import os
import aiofiles
from datetime import datetime

from models.log import TaskLog


class LogService:
    """日志服务类"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.log_dir = "logs"
        # 确保日志目录存在
        os.makedirs(self.log_dir, exist_ok=True)
    
    async def create_log_entry(self, task_id: int, log_file_path: str) -> TaskLog:
        """创建日志记录"""
        log_entry = TaskLog(
            task_id=task_id,
            log_file_path=log_file_path,
            start_time=datetime.utcnow()
        )
        
        self.db.add(log_entry)
        await self.db.commit()
        await self.db.refresh(log_entry)
        return log_entry
    
    async def get_task_logs(self, task_id: int) -> List[TaskLog]:
        """获取任务的所有日志"""
        result = await self.db.execute(
            select(TaskLog)
            .where(TaskLog.task_id == task_id)
            .order_by(TaskLog.created_at.desc())
        )
        return result.scalars().all()
    
    async def get_log_content(self, log_file_path: str, max_lines: int = 10000) -> tuple[str, int]:
        """读取日志文件内容"""
        # 如果传入的是相对路径，转换为绝对路径
        if not os.path.isabs(log_file_path):
            # 获取当前文件所在目录的绝对路径
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            log_file_path = os.path.join(base_dir, log_file_path)
        
        if not os.path.exists(log_file_path):
            return f"日志文件不存在: {log_file_path}", 0
        
        try:
            # 尝试多种编码方式读取
            encodings = ['utf-8', 'gbk', 'gb2312', 'cp936', 'latin-1']
            for encoding in encodings:
                try:
                    async with aiofiles.open(log_file_path, 'r', encoding=encoding, errors='ignore') as f:
                        lines = await f.readlines()
                        total_lines = len(lines)
                        
                        # 只返回最后max_lines行
                        if total_lines > max_lines:
                            lines = lines[-max_lines:]
                        
                        content = ''.join(lines)
                        return content, total_lines
                except UnicodeDecodeError:
                    continue
            
            # 如果所有编码都失败，以二进制模式读取并忽略错误
            async with aiofiles.open(log_file_path, 'r', encoding='utf-8', errors='replace') as f:
                lines = await f.readlines()
                total_lines = len(lines)
                
                if total_lines > max_lines:
                    lines = lines[-max_lines:]
                
                content = ''.join(lines)
                return content, total_lines
        except Exception as e:
            return f"读取日志文件失败: {str(e)}", 0
    
    async def cleanup_old_logs(self, task_id: int, max_files: int = 7):
        """清理旧的日志文件，保留最新的max_files个"""
        logs = await self.get_task_logs(task_id)
        
        if len(logs) > max_files:
            # 删除多余的日志记录和文件
            logs_to_delete = logs[max_files:]
            
            for log in logs_to_delete:
                # 删除文件
                if os.path.exists(log.log_file_path):
                    try:
                        os.remove(log.log_file_path)
                    except Exception:
                        pass  # 忽略删除文件的错误
                
                # 删除数据库记录
                await self.db.execute(
                    delete(TaskLog).where(TaskLog.id == log.id)
                )
            
            await self.db.commit()
    
    async def end_log_entry(self, log_id: int):
        """结束日志记录"""
        log_entry = await self.db.execute(
            select(TaskLog).where(TaskLog.id == log_id)
        )
        log_entry = log_entry.scalar_one_or_none()
        
        if log_entry:
            log_entry.end_time = datetime.utcnow()
            await self.db.commit()
    
    def generate_log_file_path(self, task_id: int, task_name: str) -> str:
        """生成日志文件路径"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_task_name = "".join(c for c in task_name if c.isalnum() or c in (' ', '-', '_')).rstrip()
        safe_task_name = safe_task_name.replace(' ', '_')
        
        filename = f"task_{task_id}_{safe_task_name}_{timestamp}.txt"
        return os.path.join(self.log_dir, filename)