import request from './index'
import type { TransactionListResponse, PeriodSummary, TimelinePoint, CategoryStat } from '@/types'

export const getBills = (params: {
  period?: string
  year?: number
  month?: number
  week?: number
  day?: number
  flow_type?: string
  category?: string
  sort_by?: string
  page?: number
  size?: number
}): Promise<TransactionListResponse> => request.get('/bills', { params })

export const deleteBill = (id: number) => request.delete(`/bills/${id}`)

export const getSummary = (params: {
  period?: string
  year?: number
  month?: number
  week?: number
}): Promise<PeriodSummary> => request.get('/stats/summary', { params })

export const getTimeline = (params: {
  period?: string
  start?: string
  end?: string
}): Promise<TimelinePoint[]> => request.get('/stats/timeline', { params })

export const getCategoryStats = (params: {
  period?: string
  year?: number
  month?: number
  week?: number
  flow_type?: string
}): Promise<CategoryStat[]> => request.get('/stats/category', { params })

export const uploadCSV = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return request.post('/upload/csv', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const uploadImage = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return request.post('/upload/image', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
