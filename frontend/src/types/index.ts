export interface Server {
  id: string
  name: string
  host: string
  port: number
  description?: string
  status: 'online' | 'offline' | 'maintenance' | 'error'
  last_heartbeat?: string
  system?: {
    cpu_usage: string
    memory_usage: string
    disk_usage: string
    memory_total: string
    disk_total: string
    gpu_memory_usage?: string
    gpu_memory_total?: string
  }
  service?: string
  version?: string
  database?: string
  scheduler?: string
}

export interface ServerConfig {
  id: string
  name: string
  host: string
  port: number
  description?: string
}

export interface Task {
  id: number
  name: string
  server_id?: string
  activate_env_command: string
  main_program_command: string
  repeat_type: 'none' | 'daily' | 'weekly' | 'monthly'
  start_time: string
  end_time?: string
  status: 'pending' | 'running' | 'stopped' | 'error'
  created_at: string
  updated_at: string
}

export interface TaskCreate {
  name: string
  server_id?: string
  activate_env_command: string
  main_program_command: string
  repeat_type: 'none' | 'daily' | 'weekly' | 'monthly'
  start_time: string
  end_time?: string
}

export interface TaskUpdate {
  name?: string
  activate_env_command?: string
  main_program_command?: string
  repeat_type?: 'none' | 'daily' | 'weekly' | 'monthly'
  start_time?: string
  end_time?: string
}

export interface TaskLog {
  id: number
  task_id: number
  log_file_path: string
  start_time: string
  end_time?: string
  created_at: string
}

export interface LogContent {
  content: string
  file_path: string
}

export interface TaskListResponse {
  tasks: Task[]
  total: number
}

export interface ApiResponse<T> {
  data: T
  message?: string
  success: boolean
}