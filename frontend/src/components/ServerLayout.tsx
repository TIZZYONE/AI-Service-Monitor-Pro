import React, { useEffect, useState, useRef } from 'react'
import { Routes, Route, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Layout, Menu, Breadcrumb, Button, Tag, Popover, List, Tooltip, Card, Typography } from 'antd'
import { AppstoreOutlined, FileTextOutlined, ArrowLeftOutlined, DashboardOutlined, HddOutlined, ThunderboltOutlined, InfoCircleOutlined } from '@ant-design/icons'
import ServerTaskManager from '../pages/ServerTaskManager'
import ServerLogViewer from '../pages/ServerLogViewer'
import { multiServerApi } from '../services/multiServerApi'
import type { Server } from '../types'
import { parseGpuUsage } from '../utils/gpu'

const { Content, Sider } = Layout
const { Text } = Typography

const ServerLayout: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { serverId } = useParams<{ serverId: string }>()
  const [server, setServer] = useState<Server | null>(null)
  const [loading, setLoading] = useState(true)
  const isFirstLoadRef = useRef(true)

  useEffect(() => {
    const loadServerInfo = async () => {
      if (!serverId) return
      
      try {
        // 首次加载时显示loading，后续刷新时不显示
        if (isFirstLoadRef.current) {
          setLoading(true)
          isFirstLoadRef.current = false
        }
        const serverInfo = await multiServerApi.getServerInfo(serverId)
        setServer(serverInfo)
      } catch (error) {
        console.error('Failed to load server info:', error)
      } finally {
        setLoading(false)
      }
    }

    // 重置首次加载标志
    isFirstLoadRef.current = true

    // 立即加载一次
    loadServerInfo()

    // 每10秒刷新一次系统信息（CPU、GPU等）
    const interval = setInterval(() => {
      loadServerInfo()
    }, 10000) // 10秒

    // 清理定时器
    return () => {
      clearInterval(interval)
    }
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
        </div>
        
        <Layout>
          <Sider width={200} theme="light" style={{ borderRadius: 12, background: '#ffffff', display: 'flex', flexDirection: 'column' }}>
            <Menu
              mode="inline"
              selectedKeys={[location.pathname]}
              items={menuItems}
              onClick={({ key }) => {
                navigate(key)
              }}
              style={{ flex: 1 }}
            />
            {/* 服务器信息卡片 */}
            {server && server.status === 'online' && server.system && (
              <Card 
                size="small" 
                title={
                  <div>
                    <Text strong style={{ fontSize: 14 }}>{server.name}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {server.host}:{server.port}
                    </Text>
                  </div>
                }
                style={{ marginTop: 'auto', marginBottom: 16 }}
                bodyStyle={{ padding: '12px' }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Tooltip
                    title={
                      <div>
                        <div>CPU使用率: {server.system?.cpu_usage || 'N/A'}</div>
                        {server.system?.cpu_count_physical && (
                          <div>物理核心: {server.system.cpu_count_physical}核</div>
                        )}
                        {server.system?.cpu_count_logical && (
                          <div>逻辑核心: {server.system.cpu_count_logical}核</div>
                        )}
                        {server.system?.cpu_freq_current_mhz != null && (
                          <div>当前频率: {server.system.cpu_freq_current_mhz.toFixed(2)} MHz</div>
                        )}
                        {server.system?.cpu_freq_max_mhz != null && (
                          <div>最大频率: {server.system.cpu_freq_max_mhz.toFixed(2)} MHz</div>
                        )}
                      </div>
                    }
                  >
                    <Tag style={{ background: '#ecfdf5', borderColor: '#d1fae5', color: '#065f46', borderRadius: 8, padding: '4px 8px', fontSize: 11, cursor: 'help', margin: 0, width: '100%', textAlign: 'center' }}>
                      <DashboardOutlined style={{ marginRight: 4 }} />
                      CPU {server.system?.cpu_usage || 'N/A'}
                      {server.system?.cpu_count_logical && ` (${server.system.cpu_count_logical}核)`}
                    </Tag>
                  </Tooltip>
                  <Tag style={{ background: '#eff6ff', borderColor: '#dbeafe', color: '#1e3a8a', borderRadius: 8, padding: '4px 8px', fontSize: 11, margin: 0, width: '100%', textAlign: 'center' }}>
                    <DashboardOutlined style={{ marginRight: 4 }} />
                    内存 {server.system.memory_usage}
                    {server.system.memory_total ? ` / ${server.system.memory_total}` : ''}
                  </Tag>
                  <Tag style={{ background: '#f5f3ff', borderColor: '#ede9fe', color: '#5b21b6', borderRadius: 8, padding: '4px 8px', fontSize: 11, margin: 0, width: '100%', textAlign: 'center' }}>
                    <HddOutlined style={{ marginRight: 4 }} />
                    磁盘 {server.system.disk_usage}
                    {server.system.disk_total ? ` / ${server.system.disk_total}` : ''}
                  </Tag>
                  {server.system.gpu_memory_usage && (
                    (() => {
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
                        <div style={{ minWidth: 320, maxWidth: 500 }}>
                          {server.system?.gpu_driver_version && (
                            <div style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', marginBottom: 8 }}>
                              <div style={{ fontSize: 12, color: '#64748b' }}>驱动版本: <span style={{ fontWeight: 500, color: '#0f172a' }}>{server.system.gpu_driver_version}</span></div>
                            </div>
                          )}
                          <List
                            size="small"
                            dataSource={g.cards}
                            renderItem={(item: any) => {
                              const card = server.system?.gpus?.find((gpu: any) => gpu.index === item.index)
                              return (
                                <List.Item style={{ padding: '12px', borderBottom: '1px solid #f3f4f6' }}>
                                  <div style={{ width: '100%' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                      <span style={{ fontWeight: 600, fontSize: 14 }}>GPU {item.index}</span>
                                      {card?.name && (
                                        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>{card.name}</span>
                                      )}
                                    </div>
                                    <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.8 }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>显存:</span>
                                        <span style={{ fontWeight: 500 }}>
                                          {item.usedGB !== undefined && item.totalGB !== undefined
                                            ? `${item.usedGB.toFixed(2)}GB / ${item.totalGB.toFixed(2)}GB`
                                            : 'N/A'}
                                          {item.percent !== undefined ? ` (${item.percent.toFixed(1)}%)` : ''}
                                        </span>
                                      </div>
                                      {card?.utilization_percent != null && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                          <span>GPU利用率:</span>
                                          <span style={{ fontWeight: 500 }}>{card.utilization_percent.toFixed(1)}%</span>
                                        </div>
                                      )}
                                      {card?.temperature_celsius != null && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                          <span>温度:</span>
                                          <span style={{ fontWeight: 500, color: card.temperature_celsius > 80 ? '#dc2626' : card.temperature_celsius > 70 ? '#f59e0b' : '#059669' }}>
                                            {card.temperature_celsius.toFixed(1)}°C
                                          </span>
                                        </div>
                                      )}
                                      {card?.power_draw_watts != null && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                          <span>功耗:</span>
                                          <span style={{ fontWeight: 500 }}>{card.power_draw_watts.toFixed(1)}W</span>
                                        </div>
                                      )}
                                      {card?.memory_clock_mhz != null && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                          <span>显存频率:</span>
                                          <span style={{ fontWeight: 500 }}>{card.memory_clock_mhz.toFixed(0)} MHz</span>
                                        </div>
                                      )}
                                      {card?.graphics_clock_mhz != null && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                          <span>核心频率:</span>
                                          <span style={{ fontWeight: 500 }}>{card.graphics_clock_mhz.toFixed(0)} MHz</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </List.Item>
                              )
                            }}
                            style={{ maxHeight: 400, overflowY: 'auto' }}
                          />
                        </div>
                      ) : (
                        <div style={{ padding: 8, color: '#64748b' }}>当前后端未提供逐卡数据</div>
                      )

                      return (
                        <Popover content={content} placement="right" trigger="click">
                          <Tag style={{ background: '#fff7ed', borderColor: '#ffedd5', color: '#9a3412', borderRadius: 8, padding: '4px 8px', fontSize: 11, cursor: 'pointer', margin: 0, width: '100%', textAlign: 'center' }}>
                            <ThunderboltOutlined style={{ marginRight: 4 }} />
                            显存 {total} · {average}
                            <InfoCircleOutlined style={{ marginLeft: 4 }} />
                          </Tag>
                        </Popover>
                      )
                    })()
                  )}
                </div>
              </Card>
            )}
            {server && server.status !== 'online' && (
              <Card 
                size="small" 
                title={
                  <div>
                    <Text strong style={{ fontSize: 14 }}>{server.name}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {server.host}:{server.port}
                    </Text>
                  </div>
                }
                style={{ marginTop: 'auto', marginBottom: 16 }}
                bodyStyle={{ padding: '12px' }}
              >
                <Tag style={{ background: '#f1f5f9', borderColor: '#e2e8f0', color: '#334155', borderRadius: 8, padding: '4px 8px', fontSize: 11, margin: 0, width: '100%', textAlign: 'center' }}>
                  设备离线，无法获取信息
                </Tag>
              </Card>
            )}
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