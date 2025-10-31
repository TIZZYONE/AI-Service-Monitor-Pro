"""
任务调度器
"""
import asyncio
import subprocess
import psutil
import os
import logging
from datetime import datetime, timedelta
from typing import Dict, Optional
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.date import DateTrigger
from apscheduler.triggers.cron import CronTrigger

from core.database import AsyncSessionLocal
from services.task_service import TaskService
from services.log_service import LogService
from models.task import Task, TaskStatus, RepeatType

# 配置日志
logger = logging.getLogger(__name__)


class TaskScheduler:
    """任务调度器类"""
    
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.running_processes: Dict[int, subprocess.Popen] = {}
        self.task_log_entries: Dict[int, int] = {}  # task_id -> log_entry_id
    
    async def start(self):
        """启动调度器"""
        self.scheduler.start()
        
        # 加载现有的待执行任务
        await self._load_pending_tasks()
        
        # 启动监控任务
        self.scheduler.add_job(
            self._monitor_tasks,
            'interval',
            seconds=30,
            id='monitor_tasks'
        )
    
    async def stop(self):
        """停止调度器"""
        # 停止所有正在运行的任务
        for task_id in list(self.running_processes.keys()):
            await self.stop_task(task_id)
        
        self.scheduler.shutdown()
    
    def _get_conda_init_command(self) -> str:
        """获取conda初始化命令"""
        import platform
        
        system = platform.system().lower()
        
        if system == "windows":
            # Windows PowerShell环境
            return 'powershell -Command "& { conda shell.powershell hook | Out-String | Invoke-Expression }"'
        elif system in ["linux", "darwin"]:  # Linux或macOS
            # Bash环境
            conda_base = os.environ.get('CONDA_EXE', 'conda')
            conda_base_dir = os.path.dirname(os.path.dirname(conda_base)) if conda_base != 'conda' else '/opt/conda'
            return f'source {conda_base_dir}/etc/profile.d/conda.sh'
        else:
            # 默认尝试直接使用conda命令
            return 'eval "$(conda shell.bash hook)"'
    
    async def _load_pending_tasks(self):
        """加载待执行的任务"""
        async with AsyncSessionLocal() as db:
            service = TaskService(db)
            # 加载全部任务，确保重复任务在服务重启后也能被调度
            tasks = await service.get_tasks(skip=0, limit=10000)
            now = datetime.utcnow()
            for task in tasks:
                try:
                    # 重复任务：无论当前状态都应当被调度
                    if task.repeat_type != RepeatType.NONE:
                        await self._schedule_task(task)
                    else:
                        # 一次性任务：仅在状态为等待中且开始时间未过期时调度
                        if task.status == TaskStatus.PENDING and task.start_time and task.start_time > now:
                            await self._schedule_task(task)
                except Exception as e:
                    logger.error(f"调度任务 {task.id} 失败: {str(e)}")
    
    async def _schedule_task(self, task: Task):
        """调度单个任务"""
        job_id = f"task_{task.id}"
        
        # 移除已存在的任务
        if self.scheduler.get_job(job_id):
            self.scheduler.remove_job(job_id)
        
        # 根据重复类型设置触发器
        if task.repeat_type == RepeatType.NONE:
            # 一次性任务
            trigger = DateTrigger(run_date=task.start_time)
        elif task.repeat_type == RepeatType.DAILY:
            # 每日重复
            trigger = CronTrigger(
                hour=task.start_time.hour,
                minute=task.start_time.minute,
                second=task.start_time.second
            )
        elif task.repeat_type == RepeatType.WEEKLY:
            # 每周重复
            trigger = CronTrigger(
                day_of_week=task.start_time.weekday(),
                hour=task.start_time.hour,
                minute=task.start_time.minute,
                second=task.start_time.second
            )
        elif task.repeat_type == RepeatType.MONTHLY:
            # 每月重复
            trigger = CronTrigger(
                day=task.start_time.day,
                hour=task.start_time.hour,
                minute=task.start_time.minute,
                second=task.start_time.second
            )
        elif task.repeat_type == RepeatType.QUARTERLY:
            # 每季度重复（每3个月）
            trigger = CronTrigger(
                month=f"{task.start_time.month}/3",
                day=task.start_time.day,
                hour=task.start_time.hour,
                minute=task.start_time.minute,
                second=task.start_time.second
            )
        else:
            return
        
        # 添加任务到调度器
        self.scheduler.add_job(
            self._execute_task,
            trigger,
            args=[task.id],
            id=job_id,
            max_instances=1,
            replace_existing=True
        )
        
        # 如果有结束时间，添加停止任务
        if task.end_time:
            stop_job_id = f"stop_task_{task.id}"
            # 仅在结束时间在未来时创建停止作业
            if task.end_time > datetime.utcnow():
                stop_trigger = DateTrigger(run_date=task.end_time)
                
                self.scheduler.add_job(
                    self.stop_task,
                    stop_trigger,
                    args=[task.id],
                    id=stop_job_id,
                    replace_existing=True
                )
    
    async def _execute_task(self, task_id: int):
        """执行任务"""
        logger.info(f"开始执行任务 {task_id}")
        async with AsyncSessionLocal() as db:
            service = TaskService(db)
            log_service = LogService(db)
            
            task = await service.get_task(task_id)
            if not task:
                logger.warning(f"任务 {task_id} 不存在")
                return
            
            logger.info(f"任务 {task_id} 当前状态: {task.status}")
            
            # 检查任务是否已在运行
            if task.status == TaskStatus.RUNNING:
                logger.info(f"任务 {task_id} 已在运行中")
                return
            
            try:
                logger.info(f"开始启动任务 {task_id}: {task.name}")
                
                # 更新任务状态为运行中
                await service.update_task_status(task_id, TaskStatus.RUNNING)
                logger.info(f"任务 {task_id} 状态已更新为 RUNNING")
                
                # 创建日志文件
                log_file_path = log_service.generate_log_file_path(task_id, task.name)
                logger.info(f"任务 {task_id} 日志文件路径: {log_file_path}")
                
                log_entry = await log_service.create_log_entry(task_id, log_file_path)
                self.task_log_entries[task_id] = log_entry.id
                logger.info(f"任务 {task_id} 日志条目已创建，ID: {log_entry.id}")
                
                # 构建完整的命令，添加conda初始化
                # 检测是否需要conda环境激活
                if 'conda activate' in task.activate_env_command:
                    # 为conda环境添加初始化命令
                    conda_init_command = self._get_conda_init_command()
                    full_command = f"{conda_init_command} && {task.activate_env_command} && {task.main_program_command}"
                else:
                    full_command = f"{task.activate_env_command} && {task.main_program_command}"
                
                logger.info(f"任务 {task_id} 完整命令: {full_command}")
                
                # 启动进程
                logger.info(f"正在启动任务 {task_id} 的进程...")
                
                # 设置环境变量，确保conda可以正常工作
                env = os.environ.copy()
                
                process = subprocess.Popen(
                    full_command,
                    shell=True,
                    stdout=open(log_file_path, 'w', encoding='utf-8'),
                    stderr=subprocess.STDOUT,
                    cwd=None,  # 使用默认工作目录，避免路径解析错误
                    env=env
                )
                
                # 保存进程信息
                self.running_processes[task_id] = process
                await service.update_task_status(task_id, TaskStatus.RUNNING, process.pid)
                
                logger.info(f"任务 {task.name} (ID: {task_id}) 已启动，PID: {process.pid}")
                
            except Exception as e:
                logger.error(f"启动任务 {task_id} 失败: {str(e)}")
                import traceback
                logger.error(f"详细错误信息: {traceback.format_exc()}")
                await service.update_task_status(task_id, TaskStatus.FAILED)
                
                # 结束日志记录
                if task_id in self.task_log_entries:
                    await log_service.end_log_entry(self.task_log_entries[task_id])
                    del self.task_log_entries[task_id]
    
    async def stop_task(self, task_id: int) -> bool:
        """停止任务"""
        async with AsyncSessionLocal() as db:
            service = TaskService(db)
            log_service = LogService(db)
            
            task = await service.get_task(task_id)
            if not task:
                return False
            
            try:
                # 停止进程
                if task_id in self.running_processes:
                    process = self.running_processes[task_id]
                    
                    # 尝试优雅停止
                    try:
                        parent = psutil.Process(process.pid)
                        children = parent.children(recursive=True)
                        
                        # 停止子进程
                        for child in children:
                            child.terminate()
                        
                        # 停止主进程
                        parent.terminate()
                        
                        # 等待进程结束
                        gone, alive = psutil.wait_procs(children + [parent], timeout=5)
                        
                        # 强制杀死仍在运行的进程
                        for p in alive:
                            p.kill()
                            
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        pass
                    
                    del self.running_processes[task_id]
                
                # 更新任务状态
                await service.update_task_status(task_id, TaskStatus.STOPPED, None)
                
                # 结束日志记录
                if task_id in self.task_log_entries:
                    await log_service.end_log_entry(self.task_log_entries[task_id])
                    del self.task_log_entries[task_id]
                
                # 清理旧日志文件
                await log_service.cleanup_old_logs(task_id)
                
                print(f"任务 {task.name} (ID: {task_id}) 已停止")
                return True
                
            except Exception as e:
                print(f"停止任务 {task_id} 失败: {str(e)}")
                return False
    
    async def start_task_immediately(self, task_id: int) -> bool:
        """立即启动任务"""
        logger.info(f"收到立即启动任务请求: {task_id}")
        try:
            await self._execute_task(task_id)
            logger.info(f"任务 {task_id} 立即启动成功")
            return True
        except Exception as e:
            logger.error(f"立即启动任务 {task_id} 失败: {str(e)}")
            import traceback
            logger.error(f"详细错误信息: {traceback.format_exc()}")
            return False
    
    async def _monitor_tasks(self):
        """监控任务状态"""
        async with AsyncSessionLocal() as db:
            service = TaskService(db)
            log_service = LogService(db)
            
            # 检查运行中的任务
            for task_id, process in list(self.running_processes.items()):
                try:
                    # 检查进程是否还在运行
                    if process.poll() is not None:
                        # 进程已结束
                        exit_code = process.returncode
                        
                        if exit_code == 0:
                            await service.update_task_status(task_id, TaskStatus.COMPLETED, None)
                        else:
                            await service.update_task_status(task_id, TaskStatus.FAILED, None)
                        
                        # 结束日志记录
                        if task_id in self.task_log_entries:
                            await log_service.end_log_entry(self.task_log_entries[task_id])
                            del self.task_log_entries[task_id]
                        
                        del self.running_processes[task_id]
                        
                        task = await service.get_task(task_id)
                        if task:
                            print(f"任务 {task.name} (ID: {task_id}) 已结束，退出码: {exit_code}")
                
                except Exception as e:
                    print(f"监控任务 {task_id} 时出错: {str(e)}")
    
    async def reschedule_task(self, task_id: int):
        """重新调度任务"""
        async with AsyncSessionLocal() as db:
            service = TaskService(db)
            task = await service.get_task(task_id)
            
            if task:
                await self._schedule_task(task)