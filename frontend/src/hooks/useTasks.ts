import { useQuery, useMutation, useQueryClient } from 'react-query'
import { message } from 'antd'
import { taskApi } from '../services/api'
import { Task, TaskCreate, TaskUpdate } from '../types'

// 获取所有任务
export const useTasks = () => {
  return useQuery('tasks', () => taskApi.getTasks(), {
    select: (data) => data?.tasks || [],
    onError: () => {
      message.error('获取任务列表失败')
    },
  })
}

// 获取单个任务
export const useTask = (id: number) => {
  return useQuery(['task', id], () => taskApi.getTask(id), {
    enabled: !!id,
    onError: () => {
      message.error('获取任务详情失败')
    },
  })
}

// 获取运行中的任务
export const useRunningTasks = () => {
  return useQuery('runningTasks', () => taskApi.getRunningTasks(), {
    refetchInterval: 5000, // 每5秒刷新一次
    onError: () => {
      message.error('获取运行中任务失败')
    },
  })
}

// 创建任务
export const useCreateTask = () => {
  const queryClient = useQueryClient()
  
  return useMutation((task: TaskCreate) => taskApi.createTask(task), {
    onSuccess: () => {
      message.success('任务创建成功')
      queryClient.invalidateQueries('tasks')
    },
    onError: () => {
      message.error('任务创建失败')
    },
  })
}

// 更新任务
export const useUpdateTask = () => {
  const queryClient = useQueryClient()
  
  return useMutation(
    ({ id, task }: { id: number; task: TaskUpdate }) => 
      taskApi.updateTask(id, task),
    {
      onSuccess: () => {
        message.success('任务更新成功')
        queryClient.invalidateQueries('tasks')
        queryClient.invalidateQueries('runningTasks')
      },
      onError: () => {
        message.error('任务更新失败')
      },
    }
  )
}

// 删除任务
export const useDeleteTask = () => {
  const queryClient = useQueryClient()
  
  return useMutation((id: number) => taskApi.deleteTask(id), {
    onSuccess: () => {
      message.success('任务删除成功')
      queryClient.invalidateQueries('tasks')
      queryClient.invalidateQueries('runningTasks')
    },
    onError: () => {
      message.error('任务删除失败')
    },
  })
}

// 启动任务
export const useStartTask = () => {
  const queryClient = useQueryClient()
  
  return useMutation((id: number) => taskApi.startTask(id), {
    onSuccess: () => {
      message.success('任务启动成功')
      queryClient.invalidateQueries('tasks')
      queryClient.invalidateQueries('runningTasks')
    },
    onError: () => {
      message.error('任务启动失败')
    },
  })
}

// 停止任务
export const useStopTask = () => {
  const queryClient = useQueryClient()
  
  return useMutation((id: number) => taskApi.stopTask(id), {
    onSuccess: () => {
      message.success('任务停止成功')
      queryClient.invalidateQueries('tasks')
      queryClient.invalidateQueries('runningTasks')
    },
    onError: () => {
      message.error('任务停止失败')
    },
  })
}