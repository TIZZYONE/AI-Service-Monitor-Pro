import React, { useEffect, useState } from 'react'
import { Routes, Route, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Layout, Menu, Typography, Breadcrumb, Button } from 'antd'
import { AppstoreOutlined, FileTextOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import ServerTaskManager from '../pages/ServerTaskManager'
import ServerLogViewer from '../pages/ServerLogViewer'
import { multiServerApi } from '../services/multiServerApi'
import type { Server } from '../types'

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
        <div style={{ padding: '16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Button 
              icon={<ArrowLeftOutlined />} 
              onClick={handleBackToServers}
              type="text"
            >
              返回服务器列表
            </Button>
            <Breadcrumb
              items={[
                { title: '服务器管理' },
                { title: server.name },
                { title: location.pathname.includes('/tasks') ? '任务管理' : '日志查看' }
              ]}
            />
          </div>
          <Title level={4} style={{ margin: 0 }}>
            {server.name} ({server.host}:{server.port})
          </Title>
        </div>
        
        <Layout>
          <Sider width={200} theme="light">
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