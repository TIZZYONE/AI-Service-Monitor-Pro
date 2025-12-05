import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout, Typography, App as AntdApp } from 'antd'
import ServerDashboard from './pages/ServerDashboard'
import ServerLayout from './components/ServerLayout'

const { Header, Content } = Layout
const { Title } = Typography

const App: React.FC = () => {
  return (
    <AntdApp>
      <Layout>
        <Header style={{ 
          display: 'flex', 
          alignItems: 'center', 
          padding: '0 24px', 
          background: 'linear-gradient(90deg, #0d1f2d 0%, #111827 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.08)'
        }}>
          <Title level={3} style={{ color: 'white', margin: 0 }}>
            任务管理系统
          </Title>
        </Header>
        <Layout>
          <Content>
            <Routes>
              <Route path="/" element={<Navigate to="/servers" replace />} />
              <Route path="/servers" element={<ServerDashboard />} />
              <Route path="/servers/:serverId/*" element={<ServerLayout />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </AntdApp>
  )
}

export default App