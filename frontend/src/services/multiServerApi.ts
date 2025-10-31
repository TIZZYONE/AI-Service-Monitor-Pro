import { Task, TaskCreate, TaskUpdate, TaskLog, LogContent, Server } from '../types'
import { serverConfigManager } from './serverConfig'

export class MultiServerApiClient {
  private static instance: MultiServerApiClient

  private constructor() {}

  static getInstance(): MultiServerApiClient {
    if (!MultiServerApiClient.instance) {
      MultiServerApiClient.instance = new MultiServerApiClient()
    }
    return MultiServerApiClient.instance
  }

  // 通用请求方法
  private async request<T>(serverId: string, endpoint: string, options: RequestInit = {}): Promise<T> {
    await serverConfigManager.ensureLoaded()
    const baseUrl = serverConfigManager.getServerUrl(serverId)
    if (!baseUrl) {
      throw new Error(`服务器 ${serverId} 未找到`)
    }

    const url = `${baseUrl}${endpoint}`
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    })

    if (!response.ok) {
      throw new Error(`请求失败: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  // 服务器健康检查
  async checkServerHealth(serverId: string): Promise<{ status: string; message?: string }> {
    try {
      // 为健康检查增加超时，避免离线服务器长时间阻塞
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000)
      const result = await this.request<{ status: string; message?: string }>(
        serverId,
        '/health',
        { signal: controller.signal }
      )
      clearTimeout(timeoutId)
      return result
    } catch (error) {
      return { status: 'error', message: error instanceof Error ? error.message : '未知错误' }
    }
  }

  // 获取服务器信息
  async getServerInfo(serverId: string): Promise<Server> {
    await serverConfigManager.ensureLoaded()
    const config = serverConfigManager.getServer(serverId)
    if (!config) {
      throw new Error(`服务器 ${serverId} 未找到`)
    }

    try {
      const health = await this.checkServerHealth(serverId)
      return {
        id: config.id,
        name: config.name,
        host: config.host,
        port: config.port,
        description: config.description,
        status: health.status === 'ok' ? 'online' : 'offline',
        last_heartbeat: new Date().toISOString(),
        system: health.system,
        service: health.service,
        version: health.version,
        database: health.database,
        scheduler: health.scheduler
      }
    } catch (error) {
      return {
        id: config.id,
        name: config.name,
        host: config.host,
        port: config.port,
        description: config.description,
        status: 'offline'
      }
    }
  }

  // 任务相关API
  async getTasks(serverId: string): Promise<Task[]> {
    const result = await this.request<{ tasks: Task[] }>(serverId, '/api/tasks')
    return result.tasks
  }

  async getTask(serverId: string, taskId: number): Promise<Task> {
    return this.request<Task>(serverId, `/api/tasks/${taskId}`)
  }

  async createTask(serverId: string, task: TaskCreate): Promise<Task> {
    return this.request<Task>(serverId, '/api/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    })
  }

  async updateTask(serverId: string, taskId: number, updates: TaskUpdate): Promise<Task> {
    return this.request<Task>(serverId, `/api/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  }

  async deleteTask(serverId: string, taskId: number): Promise<void> {
    await this.request(serverId, `/api/tasks/${taskId}`, {
      method: 'DELETE',
    })
  }

  async startTask(serverId: string, taskId: number): Promise<Task> {
    return this.request<Task>(serverId, `/api/tasks/${taskId}/start`, {
      method: 'POST',
    })
  }

  async stopTask(serverId: string, taskId: number): Promise<Task> {
    return this.request<Task>(serverId, `/api/tasks/${taskId}/stop`, {
      method: 'POST',
    })
  }

  // 日志相关API
  async getTaskLogs(serverId: string, taskId?: number): Promise<TaskLog[]> {
    const endpoint = taskId ? `/api/logs/${taskId}` : '/api/logs/running/all'
    const result = await this.request<any>(serverId, endpoint)
    
    // 如果是获取特定任务的日志，后端返回 {logs: TaskLog[], total: number}
    if (taskId && result.logs) {
      return result.logs
    }
    
    // 如果是获取所有运行任务的日志，后端直接返回 TaskLog[]
    return Array.isArray(result) ? result : []
  }

  async getLogContent(serverId: string, taskId: number, logPath: string): Promise<LogContent> {
    return this.request<LogContent>(serverId, `/api/logs/${taskId}/content?log_file_path=${encodeURIComponent(logPath)}`)
  }

  // WebSocket连接
  createWebSocket(serverId: string, endpoint: string): WebSocket | null {
    // WebSocket不支持await，这里先假定已加载；若未加载调用者应先ensureLoaded
    const baseUrl = serverConfigManager.getServerUrl(serverId)
    if (!baseUrl) {
      console.error(`服务器 ${serverId} 未找到`)
      return null
    }

    const wsUrl = baseUrl.replace('http://', 'ws://').replace('https://', 'wss://')
    return new WebSocket(`${wsUrl}${endpoint}`)
  }

  // 批量获取所有服务器状态
  async getAllServersStatus(): Promise<Server[]> {
    await serverConfigManager.ensureLoaded()
    const servers = serverConfigManager.getServers()
    const promises = servers.map(server => this.getServerInfo(server.id))
    
    try {
      return await Promise.all(promises)
    } catch (error) {
      // 如果有服务器失败，仍然返回部分结果
      const results = await Promise.allSettled(promises)
      return results
        .filter((result): result is PromiseFulfilledResult<Server> => result.status === 'fulfilled')
        .map(result => result.value)
    }
  }
}

export const multiServerApi = MultiServerApiClient.getInstance()