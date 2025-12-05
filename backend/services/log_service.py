"""
日志服务层
"""
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from typing import List, Optional, Tuple
import os
import aiofiles
from datetime import datetime, date

from models.log import TaskLog

logger = logging.getLogger(__name__)


class LogService:
    """日志服务类"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        # 使用绝对路径，基于backend目录
        # 获取backend目录的绝对路径
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.log_dir = os.path.join(base_dir, "logs")
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
    
    def generate_log_file_path(self, task_id: int, task_name: str, log_date: Optional[date] = None, part: int = 1) -> str:
        """生成日志文件路径
        
        Args:
            task_id: 任务ID
            task_name: 任务名称
            log_date: 日志日期，如果为None则使用当前日期
            part: 日志文件部分编号（用于拆分大文件）
        """
        if log_date is None:
            log_date = datetime.now().date()
        
        date_str = log_date.strftime("%Y%m%d")
        timestamp = datetime.now().strftime("%H%M%S")
        safe_task_name = "".join(c for c in task_name if c.isalnum() or c in (' ', '-', '_')).rstrip()
        safe_task_name = safe_task_name.replace(' ', '_')
        
        if part > 1:
            filename = f"task_{task_id}_{safe_task_name}_{date_str}_{timestamp}_part{part}.txt"
        else:
            filename = f"task_{task_id}_{safe_task_name}_{date_str}_{timestamp}.txt"
        return os.path.join(self.log_dir, filename)
    
    async def check_and_rotate_log(self, task_id: int, current_log_path: str, log_entry_id: int) -> Optional[Tuple[str, str]]:
        """检查并轮换日志文件
        
        检查条件：
        1. 如果当前日期与日志文件日期不同（跨天），创建新日志文件
        2. 如果日志文件超过50000行，创建新日志文件
        
        Returns:
            如果需要切换，返回新日志文件路径；否则返回None
        """
        if not os.path.exists(current_log_path):
            return None
        
        try:
            # 检查文件行数
            line_count = 0
            async with aiofiles.open(current_log_path, 'r', encoding='utf-8', errors='ignore') as f:
                async for _ in f:
                    line_count += 1
                    if line_count > 50000:
                        break
            
            # 检查是否需要切换
            need_rotate = False
            rotate_reason = ""
            
            # 检查行数
            if line_count > 50000:
                need_rotate = True
                rotate_reason = f"行数超过50000行（当前{line_count}行）"
            
            # 检查日期（从文件名中提取日期）
            try:
                filename = os.path.basename(current_log_path)
                # 文件名格式: task_{task_id}_{task_name}_{date}_{time}[_part{N}].txt
                parts = filename.replace('.txt', '').split('_')
                if len(parts) >= 4:
                    # 查找日期部分（格式：YYYYMMDD）
                    file_date_str = None
                    for part in parts:
                        if len(part) == 8 and part.isdigit():
                            file_date_str = part
                            break
                    
                    if file_date_str:
                        file_date = datetime.strptime(file_date_str, "%Y%m%d").date()
                        current_date = datetime.now().date()
                        
                        if file_date < current_date:
                            need_rotate = True
                            rotate_reason = f"跨天（文件日期：{file_date}，当前日期：{current_date}）"
            except Exception as e:
                # 如果无法解析日期，忽略
                pass
            
            if need_rotate:
                # 获取任务信息以生成新日志文件名
                from services.task_service import TaskService
                task_service = TaskService(self.db)
                task = await task_service.get_task(task_id)
                
                if not task:
                    return None
                
                # 确定新日志文件的日期和部分号
                current_date = datetime.now().date()
                
                # 检查今天是否已有日志文件
                today_logs = await self.get_task_logs(task_id)
                today_log_count = 0
                for log in today_logs:
                    if log.log_file_path and os.path.exists(log.log_file_path):
                        try:
                            log_filename = os.path.basename(log.log_file_path)
                            log_parts = log_filename.replace('.txt', '').split('_')
                            for part in log_parts:
                                if len(part) == 8 and part.isdigit():
                                    log_date_str = part
                                    log_date = datetime.strptime(log_date_str, "%Y%m%d").date()
                                    if log_date == current_date:
                                        # 检查是否是part文件
                                        if '_part' in log_filename:
                                            try:
                                                part_num = int(log_filename.split('_part')[1].replace('.txt', ''))
                                                today_log_count = max(today_log_count, part_num)
                                            except:
                                                pass
                                        else:
                                            today_log_count = max(today_log_count, 1)
                        except:
                            pass
                
                # 生成新日志文件路径
                new_part = today_log_count + 1
                new_log_path = self.generate_log_file_path(task_id, task.name, current_date, new_part)
                
                # 结束当前日志记录
                await self.end_log_entry(log_entry_id)
                
                # 创建新的日志记录
                new_log_entry = await self.create_log_entry(task_id, new_log_path)
                
                logger.info(f"任务 {task_id} 日志文件轮换：{rotate_reason}，新日志文件：{new_log_path}")
                
                return (new_log_path, rotate_reason)
        
        except Exception as e:
            logger.error(f"检查日志文件轮换失败：{str(e)}")
            import traceback
            logger.error(traceback.format_exc())
        
        return None
    
    def get_log_file_info(self, log_file_path: str) -> Tuple[Optional[date], int]:
        """获取日志文件信息
        
        Returns:
            (文件日期, 部分号)
        """
        try:
            filename = os.path.basename(log_file_path)
            parts = filename.replace('.txt', '').split('_')
            
            file_date = None
            part_num = 1
            
            # 查找日期部分
            for part in parts:
                if len(part) == 8 and part.isdigit():
                    file_date = datetime.strptime(part, "%Y%m%d").date()
                    break
            
            # 查找部分号
            if '_part' in filename:
                try:
                    part_num = int(filename.split('_part')[1].replace('.txt', ''))
                except:
                    pass
            
            return file_date, part_num
        except:
            return None, 1