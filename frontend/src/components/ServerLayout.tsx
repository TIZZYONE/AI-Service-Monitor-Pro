import React, { useEffect, useState } from 'react'
import { Routes, Route, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Layout, Menu, Typography, Breadcrumb, Button, Tag, Popover, List } from 'antd'
import { AppstoreOutlined, FileTextOutlined, ArrowLeftOutlined, DashboardOutlined, HddOutlined, ThunderboltOutlined, InfoCircleOutlined } from '@ant-design/icons'
import ServerTaskManager from '../pages/ServerTaskManager'
import ServerLogViewer from '../pages/ServerLogViewer'
import { multiServerApi } from '../services/multiServerApi'
import type { Server } from '../types'
import { parseGpuUsage } from '../utils/gpu'

const { Content, Sider } = Layout
const { Title } = Typography

const ServerLayout: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { serverId } = useParams<{ serverId: string }>()
  const [server, setServer] = useState<Server | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadServerInfo = async () => {
      if (!serverId) return
      
      try {
        setLoading(true)
        const serverInfo = await multiServerApi.getServerInfo(serverId)
        setServer(serverInfo)
      } catch (error) {
        console.error('Failed to load server info:', error)
      } finally {
        setLoading(false)
      }
    }

    loadServerInfo()
  }, [serverId])

  const menuItems = [
    {
      key: `/servers/${serverId}/tasks`,
      icon: <AppstoreOutlined />,
      label: '任务管理',
    },
    {
      key: `/servers/${serverId}/logs`,
      icon: <FileTextOutlined />,
      label: '日志查看',
    },
  ]

  const handleBackToServers = () => {
    navigate('/servers')
  }

  if (loading) {
    return (
      <Layout style={{ padding: '24px' }}>
        <Content>
          <div style={{ textAlign: 'center', padding: '50px' }}>
            加载中...
          </div>
        </Content>
      </Layout>
    )
  }

  if (!server) {
    return (
      <Layout style={{ padding: '24px' }}>
        <Content>
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <p>服务器不存在或无法访问</p>
            <Button onClick={handleBackToServers}>返回服务器列表</Button>
          </div>
        </Content>
      </Layout>
    )
  }

  return (
    <Layout>
      <Layout style={{ padding: '0 24px 24px' }}>
        <div style={{ padding: '16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(2,6,23,0.06)', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: '0 0 auto' }}>
            <Button 
              icon={<ArrowLeftOutlined />} 
              onClick={handleBackToServers}
              type="text"
            >
              返回服务器列表
            </Button>
            <Breadcrumb
              style={{ whiteSpace: 'nowrap' }}
              items={[
                { title: <span style={{ color: '#64748b' }}>服务器管理</span> },
                { title: <span style={{ color: '#64748b' }}>{server.name}</span> },
                { title: <span style={{ color: '#0f172a' }}>{location.pathname.includes('/tasks') ? '任务管理' : '日志查看'}</span> }
              ]}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flex: 1, minWidth: 0 }}>
            <Title level={4} style={{ margin: 0, color: '#0f172a', fontWeight: 600, letterSpacing: 0.2 }}>
              {server.name} ({server.host}:{server.port})
            </Title>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              {server.status === 'online' && server.system ? (
                <>
                  <Tag style={{ background: '#ecfdf5', borderColor: '#d1fae5', color: '#065f46', borderRadius: 16, padding: '2px 10px', fontSize: 12 }}>
                    <DashboardOutlined style={{ marginRight: 6 }} />CPU {server.system.cpu_usage}
                  </Tag>
                  <Tag style={{ background: '#eff6ff', borderColor: '#dbeafe', color: '#1e3a8a', borderRadius: 16, padding: '2px 10px', fontSize: 12 }}>
                    {/* 内存：显示使用量/总量（若有） */}
                    <DashboardOutlined style={{ marginRight: 6 }} />内存 {server.system.memory_usage}
                    {server.system.memory_total ? ` / ${server.system.memory_total}` : ''}
                  </Tag>
                  <Tag style={{ background: '#f5f3ff', borderColor: '#ede9fe', color: '#5b21b6', borderRadius: 16, padding: '2px 10px', fontSize: 12 }}>
                    <HddOutlined style={{ marginRight: 6 }} />磁盘 {server.system.disk_usage}
                    {server.system.disk_total ? ` / ${server.system.disk_total}` : ''}
                  </Tag>
                  {server.system.gpu_memory_usage && (
                    (() => {
                      // 优先使用后端结构化的逐卡数据；否则回退到字符串解析
                      const structured = server.system.gpus && server.system.gpus.length > 0
                      const g = structured 
                        ? {
                            totalGB: (server.system.gpus!.reduce((acc, c) => acc + (c.memory_total_mb || 0), 0)) / 1024,
                            averagePercent: server.system.gpu_percent_avg ?? undefined,
                            cards: server.system.gpus!.map((c) => ({
                              index: c.index,
                              usedGB: c.memory_used_mb !== undefined ? c.memory_used_mb / 1024 : undefined,
                              totalGB: c.memory_total_mb !== undefined ? c.memory_total_mb / 1024 : undefined,
                              percent: c.percent
                            }))
                          }
                        : parseGpuUsage(server.system.gpu_memory_usage, server.system.gpu_memory_total)
                      const average = g.averagePercent !== undefined ? `${g.averagePercent.toFixed(1)}%` : server.system.gpu_memory_usage
                      const total = g.totalGB !== undefined ? `${g.totalGB.toFixed(2)}GB` : (server.system.gpu_memory_total || '')
                      const content = g.cards.length > 0 ? (
                        <List
                          size="small"
                          dataSource={g.cards}
                          renderItem={(item) => (
                            <List.Item>
                              <span style={{ fontWeight: 500 }}>GPU{item.index}</span>
                               <span style={{ marginLeft: 8 }}>
                                {item.usedGB !== undefined && item.totalGB !== undefined
                                  ? `${item.usedGB.toFixed(2)}GB / ${item.totalGB.toFixed(2)}GB`
                                  : ''}
                                {item.percent !== undefined ? ` (${item.percent.toFixed(1)}%)` : ''}
                              </span>
                            </List.Item>
                          )}
                          style={{ minWidth: 260 }}
                        />
                      ) : (
                        <div style={{ padding: 8, color: '#64748b' }}>当前后端未提供逐卡数据</div>
                      )

                      return (
                        <Popover content={content} placement="bottomRight" trigger="click">
                          <Tag style={{ background: '#fff7ed', borderColor: '#ffedd5', color: '#9a3412', borderRadius: 16, padding: '2px 10px', fontSize: 12, cursor: 'pointer' }}>
                            <ThunderboltOutlined style={{ marginRight: 6 }} />显存 总计 {total} · 平均使用率 {average}
                            <InfoCircleOutlined style={{ marginLeft: 6 }} />
                          </Tag>
                        </Popover>
                      )
                    })()
                  )}
                </>
              ) : (
                <Tag style={{ background: '#f1f5f9', borderColor: '#e2e8f0', color: '#334155', borderRadius: 16 }}>
                  设备离线，无法获取信息
                </Tag>
              )}
            </div>
          </div>
        </div>
        
        <Layout>
          <Sider width={200} theme="light" style={{ borderRadius: 12, background: '#ffffff' }}>
            <Menu
              mode="inline"
              selectedKeys={[location.pathname]}
              items={menuItems}
              onClick={({ key }) => {
                navigate(key)
              }}
            />
          </Sider>
          <Layout style={{ padding: '0 24px' }}>
            <Content>
              <Routes>
                <Route path="tasks" element={<ServerTaskManager />} />
                <Route path="logs" element={<ServerLogViewer />} />
                <Route path="" element={<ServerTaskManager />} />
              </Routes>
            </Content>
          </Layout>
        </Layout>
      </Layout>
    </Layout>
  )
}

export default ServerLayout