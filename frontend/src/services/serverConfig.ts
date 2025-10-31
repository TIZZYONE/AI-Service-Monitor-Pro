import { ServerConfig } from '../types'

const STORAGE_KEY = 'ai_monitor_servers'
const CONFIG_ENDPOINT = '/config/servers'

// 默认服务器配置（用于首次初始化或回退）
const defaultServers: ServerConfig[] = [
  {
    id: 'local',
    name: '本地服务器',
    host: 'localhost',
    port: 8633,
    description: '本地开发环境'
  }
]

export class ServerConfigManager {
  private static instance: ServerConfigManager
  private servers: ServerConfig[] = []
  private loadingPromise: Promise<void> | null = null

  private constructor() {
    // 异步加载，确保首次使用前完成
    this.loadingPromise = this.fetchServersFromFile()
  }

  static getInstance(): ServerConfigManager {
    if (!ServerConfigManager.instance) {
      ServerConfigManager.instance = new ServerConfigManager()
    }
    return ServerConfigManager.instance
  }

  private async fetchServersFromFile(): Promise<void> {
    try {
      const resp = await fetch(CONFIG_ENDPOINT)
      if (resp.ok) {
        const data = await resp.json()
        // 接口返回数组
        this.servers = Array.isArray(data) ? data : []
        // 同步到localStorage，便于离线或回退
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.servers))
        return
      }
      throw new Error('获取配置失败')
    } catch (error) {
      // 回退到localStorage或默认
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        this.servers = stored ? JSON.parse(stored) : [...defaultServers]
      } catch (e) {
        this.servers = [...defaultServers]
      }
    }
  }

  async ensureLoaded(): Promise<void> {
    if (!this.loadingPromise) {
      this.loadingPromise = this.fetchServersFromFile()
    }
    return this.loadingPromise
  }

  // 获取所有服务器
  getServers(): ServerConfig[] {
    return [...this.servers]
  }

  // 获取单个服务器
  getServer(id: string): ServerConfig | undefined {
    return this.servers.find(server => server.id === id)
  }

  // 保存到文件与localStorage
  async saveServers(): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.servers))
    } catch (error) {
      console.error('保存到localStorage失败:', error)
    }
    try {
      await fetch(CONFIG_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.servers),
      })
    } catch (error) {
      console.error('保存到文件失败:', error)
    }
  }

  // 添加服务器
  addServer(server: Omit<ServerConfig, 'id'>): ServerConfig {
    const newServer: ServerConfig = {
      ...server,
      id: Date.now().toString()
    }
    this.servers.push(newServer)
    void this.saveServers()
    return newServer
  }

  // 更新服务器
  updateServer(id: string, updates: Partial<Omit<ServerConfig, 'id'>>): boolean {
    const index = this.servers.findIndex(server => server.id === id)
    if (index === -1) return false

    this.servers[index] = { ...this.servers[index], ...updates }
    void this.saveServers()
    return true
  }

  // 删除服务器
  deleteServer(id: string): boolean {
    const index = this.servers.findIndex(server => server.id === id)
    if (index === -1) return false

    this.servers.splice(index, 1)
    void this.saveServers()
    return true
  }

  // 获取服务器基础URL
  getServerUrl(id: string): string | null {
    const server = this.getServer(id)
    if (!server) return null
    return `http://${server.host}:${server.port}`
  }
}

export const serverConfigManager = ServerConfigManager.getInstance()