import React, { useState, useEffect } from 'react'
import { Card, Row, Col, Button, Badge, Typography, Space, Modal, Form, Input, InputNumber, message, Popconfirm } from 'antd'
import { CloudServerOutlined, PlusOutlined, EditOutlined, DeleteOutlined, SettingOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { Server, ServerConfig } from '../types'
import { multiServerApi } from '../services/multiServerApi'
import { serverConfigManager } from '../services/serverConfig'

const { Title, Text } = Typography

const ServerDashboard: React.FC = () => {
  const [servers, setServers] = useState<Server[]>([])
  const [loading, setLoading] = useState(true)
  const [configModalVisible, setConfigModalVisible] = useState(false)
  const [editingServer, setEditingServer] = useState<ServerConfig | null>(null)
  const [form] = Form.useForm()
  const navigate = useNavigate()

  // 加载服务器状态
  const loadServers = async () => {
    setLoading(true)
    try {
      const serverList = await multiServerApi.getAllServersStatus()
      setServers(serverList)
    } catch (error) {
      message.error('加载服务器状态失败')
      console.error('加载服务器状态失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadServers()
    // 定时刷新服务器状态
    const interval = setInterval(loadServers, 30000) // 30秒刷新一次
    return () => clearInterval(interval)
  }, [])

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'success'
      case 'offline': return 'default'
      case 'maintenance': return 'warning'
      case 'error': return 'error'
      default: return 'default'
    }
  }

  // 获取状态文本
  const getStatusText = (status: string) => {
    switch (status) {
      case 'online': return '在线'
      case 'offline': return '离线'
      case 'maintenance': return '维护中'
      case 'error': return '错误'
      default: return '未知'
    }
  }

  // 进入服务器管理
  const enterServer = (serverId: string) => {
    navigate(`/servers/${serverId}/tasks`)
  }

  // 打开配置弹窗
  const openConfigModal = (server?: ServerConfig) => {
    setEditingServer(server || null)
    if (server) {
      form.setFieldsValue(server)
    } else {
      form.resetFields()
    }
    setConfigModalVisible(true)
  }

  // 保存服务器配置
  const saveServerConfig = async (values: any) => {
    try {
      if (editingServer) {
        serverConfigManager.updateServer(editingServer.id, values)
        message.success('服务器配置更新成功')
      } else {
        serverConfigManager.addServer(values)
        message.success('服务器添加成功')
      }
      setConfigModalVisible(false)
      loadServers()
    } catch (error) {
      message.error('保存失败')
    }
  }

  // 删除服务器
  const deleteServer = (serverId: string) => {
    try {
      serverConfigManager.deleteServer(serverId)
      message.success('服务器删除成功')
      loadServers()
    } catch (error) {
      message.error('删除失败')
    }
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={2}>服务器管理</Title>
        <Space>
          <Button icon={<PlusOutlined />} type="primary" onClick={() => openConfigModal()}>
            添加服务器
          </Button>
          <Button icon={<SettingOutlined />} onClick={loadServers} loading={loading}>
            刷新状态
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        {servers.map((server) => (
          <Col xs={24} sm={12} lg={8} xl={6} key={server.id}>
            <Card
              hoverable
              actions={[
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  onClick={(e) => {
                    e.stopPropagation()
                    openConfigModal(serverConfigManager.getServer(server.id))
                  }}
                >
                  编辑
                </Button>,
                <Popconfirm
                  title="确定要删除这个服务器吗？"
                  onConfirm={(e) => {
                    e?.stopPropagation()
                    deleteServer(server.id)
                  }}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button 
                    type="text" 
                    icon={<DeleteOutlined />} 
                    danger
                    onClick={(e) => e.stopPropagation()}
                  >
                    删除
                  </Button>
                </Popconfirm>
              ]}
              onClick={() => server.status === 'online' && enterServer(server.id)}
              style={{ 
                cursor: server.status === 'online' ? 'pointer' : 'default',
                height: '450px',
                display: 'flex',
                flexDirection: 'column'
              }}
              bodyStyle={{ 
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                height: '100%'
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <CloudServerOutlined style={{ fontSize: '48px', color: '#1890ff', marginBottom: '16px' }} />
                <Title level={4} style={{ marginBottom: '8px' }}>{server.name}</Title>
                <Badge 
                  status={getStatusColor(server.status)} 
                  text={getStatusText(server.status)}
                  style={{ marginBottom: '12px' }}
                />
                <div style={{ marginBottom: '8px' }}>
                  <Text type="secondary">{server.host}:{server.port}</Text>
                </div>
                <div style={{ marginBottom: '12px', minHeight: '20px' }}>
                  {server.description && (
                    <Text type="secondary">{server.description}</Text>
                  )}
                </div>
                
                {/* 系统信息区域 - 始终显示，保持一致的高度 */}
                <div style={{ 
                  fontSize: '12px', 
                  color: '#666',
                  height: '180px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  padding: '8px 0',
                  borderTop: '1px solid #f0f0f0',
                  marginTop: '12px',
                  paddingTop: '12px'
                }}>
                  {server.status === 'online' && server.system ? (
                    <div style={{ lineHeight: '1.6' }}>
                      <div style={{ marginBottom: '4px' }}>CPU: {server.system.cpu_usage}</div>
                      <div style={{ marginBottom: '4px' }}>内存: {server.system.memory_usage}</div>
                      <div style={{ marginBottom: '4px' }}>磁盘: {server.system.disk_usage}</div>
                      {server.system.gpu_memory_usage && (
                        <div style={{ marginBottom: '4px' }}>显存: {server.system.gpu_memory_usage}</div>
                      )}
                    </div>
                  ) : (
                    <div style={{ 
                      color: '#999', 
                      textAlign: 'center',
                      fontStyle: 'italic'
                    }}>
                      {server.status === 'offline' ? '服务器离线，无法获取系统信息' : '系统信息不可用'}
                    </div>
                  )}
                </div>
                
                <div style={{ fontSize: '12px', color: '#999', marginTop: '8px', minHeight: '16px' }}>
                  {server.last_heartbeat && (
                    <>最后检查: {new Date(server.last_heartbeat).toLocaleString()}</>
                  )}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 服务器配置弹窗 */}
      <Modal
        title={editingServer ? '编辑服务器' : '添加服务器'}
        open={configModalVisible}
        onCancel={() => setConfigModalVisible(false)}
        onOk={() => form.submit()}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={saveServerConfig}
        >
          <Form.Item
            name="name"
            label="服务器名称"
            rules={[{ required: true, message: '请输入服务器名称' }]}
          >
            <Input placeholder="例如：生产服务器1" />
          </Form.Item>
          <Form.Item
            name="host"
            label="服务器地址"
            rules={[{ required: true, message: '请输入服务器地址' }]}
          >
            <Input placeholder="例如：192.168.1.100 或 localhost" />
          </Form.Item>
          <Form.Item
            name="port"
            label="端口"
            rules={[{ required: true, message: '请输入端口号' }]}
          >
            <InputNumber min={1} max={65535} placeholder="8633" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea placeholder="服务器描述信息（可选）" rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default ServerDashboard