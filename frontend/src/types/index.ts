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
    cpu_count_physical?: number
    cpu_count_logical?: number
    cpu_freq_current_mhz?: number
    cpu_freq_max_mhz?: number
    memory_usage: string
    disk_usage: string
    memory_total: string
    disk_total: string
    gpu_memory_usage?: string
    gpu_memory_total?: string
    gpu_percent_avg?: number
    gpu_driver_version?: string
    gpus?: {
      index: number
      name?: string
      memory_used_mb?: number
      memory_total_mb?: number
      percent?: number
      utilization_percent?: number
      temperature_celsius?: number
      power_draw_watts?: number
      driver_version?: string
      memory_clock_mhz?: number
      graphics_clock_mhz?: number
    }[]
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
  repeat_type: 'none' | 'daily' | 'weekly' | 'monthly' | 'quarterly'
  start_time: string
  end_time?: string
  status: 'pending' | 'running' | 'stopped' | 'completed' | 'failed' | 'error'
  created_at: string
  updated_at: string
}

export interface TaskCreate {
  name: string
  server_id?: string
  activate_env_command: string
  main_program_command: string
  repeat_type: 'none' | 'daily' | 'weekly' | 'monthly' | 'quarterly'
  start_time: string
  end_time?: string
}

export interface TaskUpdate {
  name?: string
  activate_env_command?: string
  main_program_command?: string
  repeat_type?: 'none' | 'daily' | 'weekly' | 'monthly' | 'quarterly'
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

export interface FileItem {
  name: string
  path: string
  is_directory: boolean
  size?: number
  modified_time?: number
}

export interface DirectoryResponse {
  current_path: string
  parent_path?: string
  items: FileItem[]
}