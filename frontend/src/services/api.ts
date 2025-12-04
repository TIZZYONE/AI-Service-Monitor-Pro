import axios from 'axios'
import { Task, TaskCreate, TaskUpdate, TaskLog, LogContent, ApiResponse, TaskListResponse } from '../types'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)

// 任务相关API
export const taskApi = {
  // 获取所有任务
  getTasks: (): Promise<TaskListResponse> => 
    api.get('/tasks'),

  // 获取单个任务
  getTask: (id: number): Promise<Task> => 
    api.get(`/tasks/${id}`),

  // 创建任务
  createTask: (task: TaskCreate): Promise<Task> => 
    api.post('/tasks', task),

  // 更新任务
  updateTask: (id: number, task: TaskUpdate): Promise<Task> => 
    api.put(`/tasks/${id}`, task),

  // 删除任务
  deleteTask: (id: number): Promise<void> => 
    api.delete(`/tasks/${id}`),

  // 获取运行中的任务
  getRunningTasks: (): Promise<Task[]> => 
    api.get('/tasks/running'),

  // 手动启动任务
  startTask: (id: number): Promise<Task> => 
    api.post(`/tasks/${id}/start`),

  // 手动停止任务
  stopTask: (id: number): Promise<Task> => 
    api.post(`/tasks/${id}/stop`),

  // 停止所有任务
  stopAllTasks: (): Promise<{ success: boolean; stopped_count: number; failed_count: number; message: string }> =>
    api.post('/tasks/stop-all'),

  // 服务器关机
  shutdownServer: (): Promise<{ success: boolean; message: string; tasks_stopped?: any }> =>
    api.post('/system/shutdown'),
}

// 日志相关API
export const logApi = {
  // 获取任务的所有日志
  getTaskLogs: (taskId: number): Promise<ApiResponse<TaskLog[]>> => 
    api.get(`/logs/${taskId}`),

  // 获取日志文件内容
  getLogContent: (taskId: number, logFilePath: string): Promise<ApiResponse<LogContent>> => 
    api.get(`/logs/${taskId}/content?log_file_path=${encodeURIComponent(logFilePath)}`),

  // 获取任务的最新日志内容
  getLatestLogContent: (taskId: number): Promise<ApiResponse<LogContent>> => 
    api.get(`/logs/${taskId}/latest`),

  // 清理旧日志
  cleanupLogs: (taskId: number): Promise<ApiResponse<null>> => 
    api.delete(`/logs/${taskId}/cleanup`),

  // 获取所有运行中任务的最新日志
  getRunningTasksLogs: (): Promise<ApiResponse<Record<number, LogContent>>> => 
    api.get('/logs/running'),
}

export default api