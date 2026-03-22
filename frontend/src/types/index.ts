export interface Transaction {
  id: number
  date: string
  amount: number
  flow_type: 'income' | 'expense'
  category?: string
  merchant?: string
  description?: string
  payment_method?: string
  tx_no?: string
  merchant_order_no?: string
  remark?: string
  source: 'wechat' | 'alipay' | 'image' | 'manual'
  created_at?: string
}

export interface TransactionListResponse {
  total: number
  items: Transaction[]
}

export interface PeriodSummary {
  income: number
  expense: number
  balance: number
}

export interface TimelinePoint {
  date: string
  income: number
  expense: number
}

export interface CategoryStat {
  category: string
  amount: number
  percent: number
}

export type PeriodType = 'year' | 'month' | 'week'
