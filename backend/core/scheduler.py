"""
任务调度器
"""
import asyncio
import subprocess
import psutil
import os
import sys
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
        self.task_log_files: Dict[int, str] = {}  # task_id -> current_log_file_path
    
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
    
    async def stop_all_tasks(self) -> dict:
        """停止所有正在运行的任务"""
        running_task_ids = list(self.running_processes.keys())
        if not running_task_ids:
            return {"success": True, "stopped_count": 0, "message": "没有正在运行的任务"}
        
        success_count = 0
        fail_count = 0
        failed_tasks = []
        
        for task_id in running_task_ids:
            try:
                result = await self.stop_task(task_id)
                if result:
                    success_count += 1
                else:
                    fail_count += 1
                    failed_tasks.append(task_id)
            except Exception as e:
                logger.error(f"停止任务 {task_id} 时出错: {str(e)}")
                fail_count += 1
                failed_tasks.append(task_id)
        
        return {
            "success": fail_count == 0,
            "stopped_count": success_count,
            "failed_count": fail_count,
            "failed_tasks": failed_tasks,
            "message": f"成功停止 {success_count} 个任务" + (f"，{fail_count} 个失败" if fail_count > 0 else "")
        }
    
    def _get_conda_init_command(self) -> str:
        """获取conda初始化命令"""
        import platform
        
        system = platform.system().lower()
        
        if system == "windows":
            # Windows上使用cmd而不是PowerShell，避免ANSI转义码问题
            # 或者使用conda run直接运行，这是更可靠的方式
            # 但为了兼容性，我们使用cmd的方式
            conda_exe = os.environ.get('CONDA_EXE', 'conda')
            if conda_exe and os.path.exists(conda_exe):
                # 如果找到conda.exe，使用其所在目录的Scripts\activate.bat
                conda_base = os.path.dirname(conda_exe)
                activate_bat = os.path.join(conda_base, 'Scripts', 'activate.bat')
                if os.path.exists(activate_bat):
                    # 返回空字符串，因为activate命令会直接使用activate.bat
                    return ''
            # 如果找不到，返回空字符串，让用户自己配置activate_env_command
            return ''
        elif system in ["linux", "darwin"]:  # Linux或macOS
            # Bash环境
            conda_base = os.environ.get('CONDA_EXE', 'conda')
            if conda_base and conda_base != 'conda':
                conda_base_dir = os.path.dirname(os.path.dirname(conda_base))
                conda_sh = os.path.join(conda_base_dir, 'etc', 'profile.d', 'conda.sh')
                if os.path.exists(conda_sh):
                    return f'source "{conda_sh}"'
            return 'eval "$(conda shell.bash hook)"'
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
            # 根据起始月份计算每季度的月份列表
            start_month = task.start_time.month
            # 计算起始月份所属的季度起始月份（1, 4, 7, 10）
            quarter_start_month = ((start_month - 1) // 3) * 3 + 1
            # 生成每季度的月份列表：从起始季度开始，每3个月一次
            quarter_months = [quarter_start_month + i*3 for i in range(4) if quarter_start_month + i*3 <= 12]
            trigger = CronTrigger(
                month=f"{','.join(map(str, quarter_months))}",
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
            # 移除已存在的停止任务
            if self.scheduler.get_job(stop_job_id):
                self.scheduler.remove_job(stop_job_id)
            
            # 根据重复类型设置停止触发器
            if task.repeat_type == RepeatType.NONE:
                # 一次性任务：在结束时间点停止
                if task.end_time > datetime.utcnow():
                    stop_trigger = DateTrigger(run_date=task.end_time)
                    self.scheduler.add_job(
                        self.stop_task,
                        stop_trigger,
                        args=[task.id],
                        id=stop_job_id,
                        replace_existing=True
                    )
            elif task.repeat_type == RepeatType.DAILY:
                # 每日重复：每天在结束时间停止
                stop_trigger = CronTrigger(
                    hour=task.end_time.hour,
                    minute=task.end_time.minute,
                    second=task.end_time.second
                )
                self.scheduler.add_job(
                    self.stop_task,
                    stop_trigger,
                    args=[task.id],
                    id=stop_job_id,
                    replace_existing=True
                )
            elif task.repeat_type == RepeatType.WEEKLY:
                # 每周重复：每周在结束时间的星期几停止
                stop_trigger = CronTrigger(
                    day_of_week=task.end_time.weekday(),
                    hour=task.end_time.hour,
                    minute=task.end_time.minute,
                    second=task.end_time.second
                )
                self.scheduler.add_job(
                    self.stop_task,
                    stop_trigger,
                    args=[task.id],
                    id=stop_job_id,
                    replace_existing=True
                )
            elif task.repeat_type == RepeatType.MONTHLY:
                # 每月重复：每月在结束时间的日期停止
                stop_trigger = CronTrigger(
                    day=task.end_time.day,
                    hour=task.end_time.hour,
                    minute=task.end_time.minute,
                    second=task.end_time.second
                )
                self.scheduler.add_job(
                    self.stop_task,
                    stop_trigger,
                    args=[task.id],
                    id=stop_job_id,
                    replace_existing=True
                )
            elif task.repeat_type == RepeatType.QUARTERLY:
                # 每季度重复：每季度在结束时间停止
                # 根据结束月份计算每季度的月份列表
                end_month = task.end_time.month
                # 计算结束月份所属的季度起始月份（1, 4, 7, 10）
                quarter_start_month = ((end_month - 1) // 3) * 3 + 1
                # 生成每季度的月份列表：从起始季度开始，每3个月一次
                quarter_months = [quarter_start_month + i*3 for i in range(4) if quarter_start_month + i*3 <= 12]
                stop_trigger = CronTrigger(
                    month=f"{','.join(map(str, quarter_months))}",
                    day=task.end_time.day,
                    hour=task.end_time.hour,
                    minute=task.end_time.minute,
                    second=task.end_time.second
                )
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
            
            # 检查是否已超过结束日期（对于重复任务，如果结束日期已过，不再执行）
            if task.end_time and task.repeat_type != RepeatType.NONE:
                now = datetime.utcnow()
                start_date = task.start_time.date()
                end_date = task.end_time.date()
                
                # 如果开始时间和结束时间的日期不同，说明有结束日期限制
                if start_date != end_date:
                    current_date = now.date()
                    if current_date > end_date:
                        logger.info(f"任务 {task_id} 已超过结束日期 {end_date}，不再执行")
                        # 移除调度器中的任务
                        job_id = f"task_{task_id}"
                        if self.scheduler.get_job(job_id):
                            self.scheduler.remove_job(job_id)
                        # 移除停止任务
                        stop_job_id = f"stop_task_{task_id}"
                        if self.scheduler.get_job(stop_job_id):
                            self.scheduler.remove_job(stop_job_id)
                        return
            
            try:
                logger.info(f"开始启动任务 {task_id}: {task.name}")
                
                # 更新任务状态为运行中
                await service.update_task_status(task_id, TaskStatus.RUNNING)
                logger.info(f"任务 {task_id} 状态已更新为 RUNNING")
                
                # 创建日志文件
                log_file_path = log_service.generate_log_file_path(task_id, task.name)
                logger.info(f"任务 {task_id} 日志文件路径: {log_file_path}")
                
                # 预创建日志文件（空文件），确保文件存在
                try:
                    # 确保日志目录存在
                    log_dir = os.path.dirname(log_file_path)
                    os.makedirs(log_dir, exist_ok=True)
                    
                    # 创建日志文件（如果不存在）
                    if not os.path.exists(log_file_path):
                        with open(log_file_path, 'w', encoding='utf-8') as f:
                            f.write(f"[任务启动] {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - 任务ID: {task_id}, 任务名称: {task.name}\n")
                        logger.info(f"任务 {task_id} 日志文件已预创建: {log_file_path}")
                    else:
                        logger.info(f"任务 {task_id} 日志文件已存在: {log_file_path}")
                except Exception as e:
                    logger.error(f"任务 {task_id} 预创建日志文件失败: {str(e)}")
                    # 不抛出异常，继续执行，让log_wrapper尝试创建
                
                log_entry = await log_service.create_log_entry(task_id, log_file_path)
                self.task_log_entries[task_id] = log_entry.id
                self.task_log_files[task_id] = log_file_path
                logger.info(f"任务 {task_id} 日志条目已创建，ID: {log_entry.id}")
                
                # 构建完整的命令，添加conda初始化
                # 检测是否需要conda环境激活
                import platform
                system = platform.system().lower()
                
                if 'conda activate' in task.activate_env_command:
                    # Windows上使用cmd而不是PowerShell来执行conda命令，避免ANSI转义码问题
                    if system == "windows":
                        # 在Windows上，使用cmd来执行整个命令链，避免PowerShell的ANSI转义码问题
                        # 这样可以保持用户命令的完整性（包括cd等命令）
                        full_command = f"{task.activate_env_command} && {task.main_program_command}"
                        # 使用cmd /c来执行，确保在cmd环境中运行
                        original_command = f'cmd /c "{full_command}"'
                    else:
                        # Linux/Mac上使用bash
                        conda_init_command = self._get_conda_init_command()
                        if conda_init_command:
                            original_command = f"{conda_init_command} && {task.activate_env_command} && {task.main_program_command}"
                        else:
                            original_command = f"{task.activate_env_command} && {task.main_program_command}"
                else:
                    original_command = f"{task.activate_env_command} && {task.main_program_command}"
                
                # 使用日志包装脚本启动任务
                # 获取包装脚本路径
                script_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                wrapper_script = os.path.join(script_dir, 'utils', 'log_wrapper.py')
                # 确保使用绝对路径
                wrapper_script = os.path.abspath(wrapper_script)
                
                # 确保包装脚本存在
                if not os.path.exists(wrapper_script):
                    logger.error(f"日志包装脚本不存在: {wrapper_script}")
                    raise FileNotFoundError(f"日志包装脚本不存在: {wrapper_script}")
                
                # 构建使用包装脚本的命令
                # 直接传递参数，避免Windows shell转义问题
                log_dir = log_service.log_dir
                
                # 使用Python解释器运行包装脚本
                python_executable = sys.executable
                
                # 构建参数列表（不使用shell=True，直接传递参数）
                # 这样original_command会作为单个字符串参数传递，避免转义问题
                wrapper_args = [
                    python_executable,
                    wrapper_script,
                    original_command,  # 原始命令作为单个参数传递
                    log_dir,
                    str(task_id),
                    task.name  # 任务名称
                ]
                
                logger.info(f"任务 {task_id} 完整命令: {original_command}")
                logger.info(f"任务 {task_id} 使用日志包装脚本启动")
                logger.info(f"任务 {task_id} Python解释器: {python_executable}")
                logger.info(f"任务 {task_id} 包装脚本路径: {wrapper_script}")
                logger.info(f"任务 {task_id} 日志目录: {log_dir}")
                logger.info(f"任务 {task_id} 包装参数: {wrapper_args}")
                
                # 验证日志目录是否存在
                if not os.path.exists(log_dir):
                    logger.warning(f"任务 {task_id} 日志目录不存在，尝试创建: {log_dir}")
                    try:
                        os.makedirs(log_dir, exist_ok=True)
                        logger.info(f"任务 {task_id} 日志目录创建成功")
                    except Exception as e:
                        logger.error(f"任务 {task_id} 日志目录创建失败: {str(e)}")
                        raise
                else:
                    logger.info(f"任务 {task_id} 日志目录已存在: {log_dir}")
                
                # 启动进程
                logger.info(f"正在启动任务 {task_id} 的进程...")
                
                # 设置环境变量，确保conda可以正常工作
                env = os.environ.copy()
                
                # 使用包装脚本启动，输出会被包装脚本处理
                # 包装脚本会将输出写入日志文件并实现轮转
                # 直接传递参数列表，避免Windows shell转义问题
                process = subprocess.Popen(
                    wrapper_args,  # 使用参数列表而不是命令字符串
                    shell=False,   # 不使用shell，直接执行
                    stdout=subprocess.PIPE,  # 包装脚本的输出（包含日志文件路径）
                    stderr=subprocess.PIPE,   # 包装脚本的错误输出
                    cwd=None,
                    env=env,
                    text=True,  # 使用文本模式，便于读取
                    encoding='utf-8',
                    errors='replace'  # 遇到编码错误时替换而不是失败
                )
                
                # 启动后台线程读取stderr，捕获日志文件路径和错误信息
                import threading
                stderr_lines = []
                
                def read_stderr():
                    try:
                        # 读取stderr输出（Windows和Linux都支持文本模式）
                        for line in iter(process.stderr.readline, ''):
                            if not line:
                                break
                            line_str = line.strip()
                            if line_str:
                                stderr_lines.append(line_str)
                                logger.info(f"任务 {task_id} stderr: {line_str}")
                                # 检查是否是日志文件路径
                                if 'LOG_FILE_PATH:' in line_str:
                                    actual_log_path = line_str.split('LOG_FILE_PATH:')[-1].strip()
                                    if actual_log_path:
                                        logger.info(f"任务 {task_id} 实际日志路径: {actual_log_path}")
                                        # 更新日志文件路径（如果不同）
                                        if actual_log_path != log_file_path:
                                            logger.warning(f"任务 {task_id} 实际日志路径与预期不同: 预期={log_file_path}, 实际={actual_log_path}")
                                            self.task_log_files[task_id] = actual_log_path
                                # 检查错误信息
                                elif 'ERROR:' in line_str or 'Error:' in line_str:
                                    logger.error(f"任务 {task_id} 错误: {line_str}")
                    except Exception as e:
                        logger.error(f"读取任务 {task_id} stderr 失败: {str(e)}")
                        import traceback
                        logger.error(traceback.format_exc())
                
                stderr_thread = threading.Thread(target=read_stderr, daemon=True)
                stderr_thread.start()
                
                # 等待一小段时间，让log_wrapper初始化并创建日志文件
                import asyncio
                await asyncio.sleep(1.0)  # 增加等待时间，确保log_wrapper有足够时间初始化
                
                # 检查进程是否已经失败
                process_exit_code = process.poll()
                if process_exit_code is not None:
                    # 进程已经结束，说明启动失败
                    error_msg = f"任务进程启动后立即退出，退出码: {process_exit_code}"
                    logger.error(f"任务 {task_id}: {error_msg}")
                    
                    # 读取所有stderr输出
                    try:
                        remaining_stderr = process.stderr.read()
                        if remaining_stderr:
                            stderr_lines.extend(remaining_stderr.strip().split('\n'))
                            logger.error(f"任务 {task_id} stderr完整输出: {remaining_stderr}")
                    except:
                        pass
                    
                    # 将错误信息写入日志文件
                    try:
                        if os.path.exists(log_file_path):
                            with open(log_file_path, 'a', encoding='utf-8') as f:
                                f.write(f"\n[错误] {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - {error_msg}\n")
                                if stderr_lines:
                                    f.write(f"[错误详情] stderr输出:\n")
                                    for line in stderr_lines:
                                        f.write(f"  {line}\n")
                                f.flush()
                        else:
                            # 如果日志文件不存在，尝试创建并写入错误信息
                            log_dir = os.path.dirname(log_file_path)
                            os.makedirs(log_dir, exist_ok=True)
                            with open(log_file_path, 'w', encoding='utf-8') as f:
                                f.write(f"[任务启动] {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - 任务ID: {task_id}, 任务名称: {task.name}\n")
                                f.write(f"[错误] {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - {error_msg}\n")
                                if stderr_lines:
                                    f.write(f"[错误详情] stderr输出:\n")
                                    for line in stderr_lines:
                                        f.write(f"  {line}\n")
                                f.flush()
                    except Exception as write_error:
                        logger.error(f"任务 {task_id} 写入错误信息到日志文件失败: {str(write_error)}")
                    
                    # 更新任务状态为失败
                    await service.update_task_status(task_id, TaskStatus.FAILED)
                    
                    # 结束日志记录
                    if task_id in self.task_log_entries:
                        await log_service.end_log_entry(self.task_log_entries[task_id])
                        del self.task_log_entries[task_id]
                    
                    # 清理进程
                    if task_id in self.running_processes:
                        del self.running_processes[task_id]
                    
                    raise Exception(f"{error_msg}. stderr: {'; '.join(stderr_lines[:5])}")  # 只显示前5行
                
                # 检查日志文件是否已创建
                if os.path.exists(log_file_path):
                    logger.info(f"任务 {task_id} 日志文件已创建: {log_file_path}")
                else:
                    logger.warning(f"任务 {task_id} 日志文件尚未创建: {log_file_path}")
                    logger.warning(f"任务 {task_id} stderr输出: {stderr_lines}")
                    
                    # 如果日志文件不存在，尝试从stderr中获取实际日志路径
                    actual_log_path = None
                    for line in stderr_lines:
                        if 'LOG_FILE_PATH:' in line:
                            actual_log_path = line.split('LOG_FILE_PATH:')[-1].strip()
                            break
                    
                    if actual_log_path and os.path.exists(actual_log_path):
                        logger.info(f"任务 {task_id} 找到实际日志文件: {actual_log_path}")
                        log_file_path = actual_log_path
                        self.task_log_files[task_id] = actual_log_path
                    else:
                        logger.error(f"任务 {task_id} 无法找到日志文件")
                
                # 保存进程信息
                self.running_processes[task_id] = process
                await service.update_task_status(task_id, TaskStatus.RUNNING, process.pid)
                
                logger.info(f"任务 {task.name} (ID: {task_id}) 已启动，PID: {process.pid}")
                logger.info(f"任务 {task_id} 日志文件路径: {log_file_path}")
                
            except Exception as e:
                error_msg = f"启动任务失败: {str(e)}"
                logger.error(f"任务 {task_id}: {error_msg}")
                import traceback
                error_traceback = traceback.format_exc()
                logger.error(f"任务 {task_id} 详细错误信息: {error_traceback}")
                
                # 将错误信息写入日志文件
                try:
                    if task_id in self.task_log_files:
                        log_file_path = self.task_log_files[task_id]
                    else:
                        log_file_path = log_service.generate_log_file_path(task_id, task.name if task else f"任务{task_id}")
                    
                    # 确保日志目录存在
                    log_dir = os.path.dirname(log_file_path)
                    os.makedirs(log_dir, exist_ok=True)
                    
                    # 写入错误信息到日志文件
                    file_exists = os.path.exists(log_file_path)
                    with open(log_file_path, 'a' if file_exists else 'w', encoding='utf-8') as f:
                        if not file_exists:
                            f.write(f"[任务启动] {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - 任务ID: {task_id}, 任务名称: {task.name if task else '未知'}\n")
                        f.write(f"\n[错误] {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - {error_msg}\n")
                        f.write(f"[错误堆栈]\n{error_traceback}\n")
                        f.flush()
                    logger.info(f"任务 {task_id} 错误信息已写入日志文件: {log_file_path}")
                except Exception as write_error:
                    logger.error(f"任务 {task_id} 写入错误信息到日志文件失败: {str(write_error)}")
                
                await service.update_task_status(task_id, TaskStatus.FAILED)
                
                # 结束日志记录
                if task_id in self.task_log_entries:
                    await log_service.end_log_entry(self.task_log_entries[task_id])
                    del self.task_log_entries[task_id]
                
                # 清理进程
                if task_id in self.running_processes:
                    try:
                        process = self.running_processes[task_id]
                        if process.poll() is None:
                            process.terminate()
                    except:
                        pass
                    del self.running_processes[task_id]
    
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
                        
                        # 清理日志文件记录
                        if task_id in self.task_log_files:
                            del self.task_log_files[task_id]
                        
                        # 关闭文件句柄
                        if process.stdout and not process.stdout.closed:
                            try:
                                process.stdout.close()
                            except:
                                pass
                        
                        del self.running_processes[task_id]
                        
                        task = await service.get_task(task_id)
                        if task:
                            print(f"任务 {task.name} (ID: {task_id}) 已结束，退出码: {exit_code}")
                    else:
                        # 进程仍在运行，检查是否有新的日志文件（包装脚本可能已经轮转了）
                        # 扫描日志目录，查找该任务的新日志文件
                        log_dir = log_service.log_dir
                        if os.path.exists(log_dir):
                            # 查找该任务的所有日志文件
                            import glob
                            pattern = os.path.join(log_dir, f"task_{task_id}_*.txt")
                            log_files = glob.glob(pattern)
                            
                            # 按修改时间排序，获取最新的日志文件
                            if log_files:
                                log_files.sort(key=lambda x: os.path.getmtime(x), reverse=True)
                                latest_log_file = log_files[0]
                                
                                # 检查这个文件是否已经在数据库中
                                current_logs = await log_service.get_task_logs(task_id)
                                existing_paths = {log.log_file_path for log in current_logs}
                                
                                # 如果最新文件不在数据库中，创建新的日志记录
                                # 将绝对路径转换为相对路径（与log_service保持一致）
                                base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                                latest_log_file_rel = os.path.relpath(latest_log_file, base_dir)
                                if latest_log_file_rel not in existing_paths and latest_log_file not in existing_paths:
                                    logger.info(f"任务 {task_id} 检测到新日志文件：{latest_log_file}")
                                    # 使用相对路径创建日志记录
                                    new_log_entry = await log_service.create_log_entry(task_id, latest_log_file_rel)
                                    self.task_log_entries[task_id] = new_log_entry.id
                                    self.task_log_files[task_id] = latest_log_file_rel
                                
                                # 检查是否有日志文件轮转
                                if task_id in self.task_log_files:
                                    current_log_path = self.task_log_files[task_id]
                                    # 比较时需要考虑相对路径和绝对路径（latest_log_file_rel已在上面计算）
                                    if latest_log_file_rel != current_log_path and latest_log_file != current_log_path:
                                        logger.info(f"任务 {task_id} 检测到日志文件轮转：{current_log_path} -> {latest_log_file_rel}")
                                        # 更新记录的日志文件路径（使用相对路径）
                                        self.task_log_files[task_id] = latest_log_file_rel
                                        # 更新日志条目ID
                                        current_logs = await log_service.get_task_logs(task_id)
                                        for log in current_logs:
                                            if log.log_file_path == latest_log_file_rel or log.log_file_path == latest_log_file:
                                                self.task_log_entries[task_id] = log.id
                                                break
                
                except Exception as e:
                    print(f"监控任务 {task_id} 时出错: {str(e)}")
    
    async def reschedule_task(self, task_id: int):
        """重新调度任务"""
        async with AsyncSessionLocal() as db:
            service = TaskService(db)
            task = await service.get_task(task_id)
            
            if task:
                await self._schedule_task(task)