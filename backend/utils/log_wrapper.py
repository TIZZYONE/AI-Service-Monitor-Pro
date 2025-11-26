#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
日志包装脚本
用于包装任务命令，实现日志文件的自动轮转
支持：
1. 按日期轮转（跨天时自动切换）
2. 按行数轮转（超过50000行自动切换）
"""
import sys
import os
import subprocess
import signal
import time
from datetime import datetime, date
from pathlib import Path
import threading

# 配置
MAX_LINES_PER_FILE = 50000
CHECK_INTERVAL = 60  # 检查间隔（秒）


class LogRotator:
    """日志轮转器"""
    
    def __init__(self, log_dir: str, task_id: int, task_name: str):
        self.log_dir = Path(log_dir)
        self.task_id = task_id
        self.task_name = task_name
        self.current_log_path = None
        self.current_log_file = None
        self.line_count = 0
        self.log_date = None
        self.running = True
        
        # 确保日志目录存在
        self.log_dir.mkdir(parents=True, exist_ok=True)
        
        # 创建初始日志文件
        self._create_new_log_file()
    
    def _generate_log_filename(self, log_date: date = None, part: int = 1) -> str:
        """生成日志文件名"""
        if log_date is None:
            log_date = datetime.now().date()
        
        date_str = log_date.strftime("%Y%m%d")
        time_str = datetime.now().strftime("%H%M%S")
        safe_task_name = "".join(c for c in self.task_name if c.isalnum() or c in (' ', '-', '_')).rstrip()
        safe_task_name = safe_task_name.replace(' ', '_')
        
        if part > 1:
            filename = f"task_{self.task_id}_{safe_task_name}_{date_str}_{time_str}_part{part}.txt"
        else:
            filename = f"task_{self.task_id}_{safe_task_name}_{date_str}_{time_str}.txt"
        
        return str(self.log_dir / filename)
    
    def _get_current_part_number(self, log_date: date) -> int:
        """获取当前日期的日志文件部分号"""
        part = 1
        for log_file in self.log_dir.glob(f"task_{self.task_id}_*_{log_date.strftime('%Y%m%d')}_*.txt"):
            filename = log_file.name
            if '_part' in filename:
                try:
                    part_num = int(filename.split('_part')[1].replace('.txt', ''))
                    part = max(part, part_num + 1)
                except:
                    pass
            else:
                part = max(part, 2)  # 如果已有非part文件，下一个从part2开始
        return part
    
    def _create_new_log_file(self):
        """创建新的日志文件"""
        # 关闭旧文件
        if self.current_log_file:
            try:
                self.current_log_file.flush()
                self.current_log_file.close()
            except:
                pass
        
        # 确定新日志文件的日期和部分号
        current_date = datetime.now().date()
        
        # 检查是否需要切换日期
        if self.log_date and self.log_date < current_date:
            # 跨天了，创建新日期的日志文件
            new_part = 1
            self.log_date = current_date
        elif self.log_date == current_date:
            # 同一天，但需要拆分（行数超限）
            new_part = self._get_current_part_number(current_date)
        else:
            # 首次创建
            self.log_date = current_date
            new_part = 1
        
        # 生成新日志文件路径
        self.current_log_path = self._generate_log_filename(self.log_date, new_part)
        
        # 打开新日志文件（追加模式）
        self.current_log_file = open(self.current_log_path, 'a', encoding='utf-8')
        self.line_count = 0
        
        # 写入轮换标记（如果不是首次创建）
        if self.log_date and new_part > 1:
            self.current_log_file.write(
                f"[日志文件轮换] {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - "
                f"创建新日志文件（部分 {new_part}）\n\n"
            )
            self.current_log_file.flush()
    
    def write(self, data: str):
        """写入日志数据"""
        if not self.current_log_file:
            self._create_new_log_file()
        
        # 写入数据
        self.current_log_file.write(data)
        self.current_log_file.flush()
        
        # 统计行数
        self.line_count += data.count('\n')
        
        # 检查是否需要轮转
        current_date = datetime.now().date()
        need_rotate = False
        
        # 检查行数
        if self.line_count > MAX_LINES_PER_FILE:
            need_rotate = True
        
        # 检查日期
        if self.log_date and self.log_date < current_date:
            need_rotate = True
        
        if need_rotate:
            self._create_new_log_file()
    
    def close(self):
        """关闭日志文件"""
        self.running = False
        if self.current_log_file:
            try:
                self.current_log_file.flush()
                self.current_log_file.close()
            except:
                pass
    
    def get_current_log_path(self) -> str:
        """获取当前日志文件路径"""
        return self.current_log_path


def run_command_with_log_rotation(command: str, log_dir: str, task_id: int, task_name: str):
    """运行命令并实现日志轮转"""
    rotator = LogRotator(log_dir, task_id, task_name)
    
    # 启动进程
    process = subprocess.Popen(
        command,
        shell=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        universal_newlines=True,
        bufsize=1  # 行缓冲
    )
    
    def signal_handler(signum, frame):
        """信号处理"""
        rotator.close()
        try:
            process.terminate()
            process.wait(timeout=5)
        except:
            try:
                process.kill()
            except:
                pass
        sys.exit(0)
    
    # 注册信号处理
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)
    
    try:
        # 实时读取进程输出并写入日志
        while True:
            # 检查进程是否结束
            if process.poll() is not None:
                # 读取剩余输出
                remaining_output = process.stdout.read()
                if remaining_output:
                    rotator.write(remaining_output)
                break
            
            # 读取一行输出（非阻塞）
            line = process.stdout.readline()
            if line:
                rotator.write(line)
            else:
                # 没有输出时短暂休眠
                time.sleep(0.1)
        
        # 等待进程结束
        exit_code = process.wait()
        
        # 关闭日志文件
        rotator.close()
        
        # 输出当前日志文件路径（供外部使用）
        print(f"LOG_FILE_PATH:{rotator.get_current_log_path()}", file=sys.stderr)
        
        sys.exit(exit_code)
        
    except Exception as e:
        rotator.close()
        try:
            process.kill()
        except:
            pass
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) < 5:
        print("Usage: log_wrapper.py <command> <log_dir> <task_id> <task_name>", file=sys.stderr)
        sys.exit(1)
    
    command = sys.argv[1]
    log_dir = sys.argv[2]
    task_id = int(sys.argv[3])
    task_name = sys.argv[4]
    
    run_command_with_log_rotation(command, log_dir, task_id, task_name)

