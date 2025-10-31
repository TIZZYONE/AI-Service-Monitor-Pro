import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout, Typography } from 'antd'
import ServerDashboard from './pages/ServerDashboard'
import ServerLayout from './components/ServerLayout'

const { Header, Content } = Layout
const { Title } = Typography

const App: React.FC = () => {
  return (
    <Layout>
      <Header style={{ display: 'flex', alignItems: 'center', padding: '0 24px' }}>
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
  )
}

export default App