import React, { useEffect, useState, useRef } from 'react'
import { Routes, Route, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Layout, Menu, Breadcrumb, Button } from 'antd'
import { AppstoreOutlined, FileTextOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import ServerTaskManager from '../pages/ServerTaskManager'
import ServerLogViewer from '../pages/ServerLogViewer'
import { multiServerApi } from '../services/multiServerApi'
import type { Server } from '../types'

const { Content, Sider } = Layout

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