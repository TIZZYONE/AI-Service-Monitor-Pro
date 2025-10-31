import React, { useEffect } from 'react'
import { Form, Input, Select, DatePicker, Button, Space } from 'antd'
import dayjs from 'dayjs'
import { Task, TaskCreate, TaskUpdate } from '../types'

const { Option } = Select
const { TextArea } = Input

interface TaskFormProps {
  initialValues?: Partial<TaskCreate> | Task
  onSubmit: (values: TaskCreate | TaskUpdate) => void
  onCancel: () => void
  loading?: boolean
  isEdit?: boolean
}

const TaskForm: React.FC<TaskFormProps> = ({
  initialValues,
  onSubmit,
  onCancel,
  loading = false,
  isEdit = false,
}) => {
  const [form] = Form.useForm()

  // 当initialValues变化时重置表单
  useEffect(() => {
    const formattedValues = formatInitialValues(initialValues)
    form.resetFields()
    form.setFieldsValue(formattedValues)
  }, [initialValues, form])

  const handleSubmit = (values: any) => {
    const formattedValues = {
      ...values,
      start_time: values.start_time.format('YYYY-MM-DD HH:mm:ss'),
      end_time: values.end_time ? values.end_time.format('YYYY-MM-DD HH:mm:ss') : undefined,
    }
    onSubmit(formattedValues)
  }

  const formatInitialValues = (values?: Partial<TaskCreate> | Task) => {
    if (!values) {
      // 如果没有初始值，设置开始时间为当前时间
      return {
        start_time: dayjs(),
      }
    }
    
    // 提取TaskCreate相关的字段，忽略Task特有的字段（如id、created_at等）
    const taskCreateFields = {
      name: values.name,
      activate_env_command: values.activate_env_command,
      main_program_command: values.main_program_command,
      repeat_type: values.repeat_type,
      start_time: values.start_time ? dayjs(values.start_time) : dayjs(),
      end_time: values.end_time ? dayjs(values.end_time) : undefined,
    }
    
    return taskCreateFields
  }

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={formatInitialValues(initialValues)}
      onFinish={handleSubmit}
    >
      <Form.Item
        name="name"
        label="任务名称"
        rules={[{ required: true, message: '请输入任务名称' }]}
      >
        <Input placeholder="请输入任务名称" />
      </Form.Item>

      <Form.Item
        name="activate_env_command"
        label="激活命令"
        rules={[{ required: true, message: '请输入激活命令' }]}
      >
        <TextArea 
          rows={3} 
          placeholder="请输入激活命令，例如：cd /path/to/project && source venv/bin/activate" 
        />
      </Form.Item>

      <Form.Item
        name="main_program_command"
        label="主程序命令"
        rules={[{ required: true, message: '请输入主程序命令' }]}
      >
        <TextArea 
          rows={3} 
          placeholder="请输入主程序命令，例如：python main.py" 
        />
      </Form.Item>

      <Form.Item
        name="repeat_type"
        label="重复类型"
        rules={[{ required: true, message: '请选择重复类型' }]}
      >
        <Select placeholder="请选择重复类型">
          <Option value="none">仅一次</Option>
          <Option value="daily">每日</Option>
          <Option value="weekly">每周</Option>
          <Option value="monthly">每月</Option>
        </Select>
      </Form.Item>

      <Form.Item
        name="start_time"
        label="开始时间"
        rules={[{ required: true, message: '请选择开始时间' }]}
      >
        <DatePicker 
          showTime 
          format="YYYY-MM-DD HH:mm:ss"
          placeholder="请选择开始时间"
          style={{ width: '100%' }}
        />
      </Form.Item>

      <Form.Item
        name="end_time"
        label="结束时间"
        tooltip="可选，如果不设置则任务将一直运行"
      >
        <DatePicker 
          showTime 
          format="YYYY-MM-DD HH:mm:ss"
          placeholder="请选择结束时间（可选）"
          style={{ width: '100%' }}
        />
      </Form.Item>

      <Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={loading}>
            {isEdit ? '更新任务' : '创建任务'}
          </Button>
          <Button onClick={onCancel}>
            取消
          </Button>
        </Space>
      </Form.Item>
    </Form>
  )
}

export default TaskForm