import sqlite3

# 连接数据库
conn = sqlite3.connect('task_manager.db')
cursor = conn.cursor()

# 查看表结构
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = cursor.fetchall()
print(f'Tables: {tables}')

# 查询任务数据
try:
    cursor.execute('SELECT * FROM tasks ORDER BY created_at DESC LIMIT 10;')
    tasks = cursor.fetchall()
    print(f'Recent tasks: {tasks}')
    
    cursor.execute('SELECT COUNT(*) FROM tasks;')
    count = cursor.fetchone()
    print(f'Total tasks: {count[0]}')
    
    # 查看表结构
    cursor.execute('PRAGMA table_info(tasks);')
    columns = cursor.fetchall()
    print(f'Task table columns: {columns}')
    
except Exception as e:
    print(f'Error querying tasks: {e}')

conn.close()