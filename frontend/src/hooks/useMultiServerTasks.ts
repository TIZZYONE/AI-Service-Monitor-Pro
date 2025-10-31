import { useQuery, useMutation, useQueryClient } from 'react-query'
import { message } from 'antd'
import { multiServerApi } from '../services/multiServerApi'
import { Task, TaskCreate, TaskUpdate } from '../types'

// 获取指定服务器的所有任务
export const useServerTasks = (serverId: string) => {
  return useQuery(
    ['serverTasks', serverId], 
    () => multiServerApi.getTasks(serverId), 
    {
      enabled: !!serverId,
      onError: () => {
        message.error(`获取服务器 ${serverId} 的任务列表失败`)
      },
    }
  )
}

// 获取指定服务器的单个任务
export const useServerTask = (serverId: string, taskId: number) => {
  return useQuery(
    ['serverTask', serverId, taskId], 
    () => multiServerApi.getTask(serverId, taskId), 
    {
      enabled: !!serverId && !!taskId,
      onError: () => {
        message.error(`获取服务器 ${serverId} 的任务详情失败`)
      },
    }
  )
}

// 创建任务到指定服务器
export const useCreateServerTask = () => {
  const queryClient = useQueryClient()
  
  return useMutation(
    ({ serverId, task }: { serverId: string; task: TaskCreate }) => 
      multiServerApi.createTask(serverId, task),
    {
      onSuccess: (_, { serverId }) => {
        message.success('任务创建成功')
        queryClient.invalidateQueries(['serverTasks', serverId])
      },
      onError: () => {
        message.error('任务创建失败')
      },
    }
  )
}

// 更新指定服务器的任务
export const useUpdateServerTask = () => {
  const queryClient = useQueryClient()
  
  return useMutation(
    ({ serverId, taskId, task }: { serverId: string; taskId: number; task: TaskUpdate }) => 
      multiServerApi.updateTask(serverId, taskId, task),
    {
      onSuccess: (_, { serverId }) => {
        message.success('任务更新成功')
        queryClient.invalidateQueries(['serverTasks', serverId])
      },
      onError: () => {
        message.error('任务更新失败')
      },
    }
  )
}

// 删除指定服务器的任务
export const useDeleteServerTask = () => {
  const queryClient = useQueryClient()
  
  return useMutation(
    ({ serverId, taskId }: { serverId: string; taskId: number }) => 
      multiServerApi.deleteTask(serverId, taskId),
    {
      onSuccess: (_, { serverId }) => {
        message.success('任务删除成功')
        queryClient.invalidateQueries(['serverTasks', serverId])
      },
      onError: () => {
        message.error('任务删除失败')
      },
    }
  )
}

// 启动指定服务器的任务
export const useStartServerTask = () => {
  const queryClient = useQueryClient()
  
  return useMutation(
    ({ serverId, taskId }: { serverId: string; taskId: number }) => 
      multiServerApi.startTask(serverId, taskId),
    {
      onSuccess: (_, { serverId }) => {
        message.success('任务启动成功')
        queryClient.invalidateQueries(['serverTasks', serverId])
      },
      onError: () => {
        message.error('任务启动失败')
      },
    }
  )
}

// 停止指定服务器的任务
export const useStopServerTask = () => {
  const queryClient = useQueryClient()
  
  return useMutation(
    ({ serverId, taskId }: { serverId: string; taskId: number }) => 
      multiServerApi.stopTask(serverId, taskId),
    {
      onSuccess: (_, { serverId }) => {
        message.success('任务停止成功')
        queryClient.invalidateQueries(['serverTasks', serverId])
      },
      onError: () => {
        message.error('任务停止失败')
      },
    }
  )
}

// 获取指定服务器的任务日志
export const useServerTaskLogs = (serverId: string, taskId?: number) => {
  return useQuery(
    ['serverTaskLogs', serverId, taskId], 
    () => multiServerApi.getTaskLogs(serverId, taskId), 
    {
      enabled: !!serverId,
      onError: () => {
        message.error(`获取服务器 ${serverId} 的任务日志失败`)
      },
    }
  )
}