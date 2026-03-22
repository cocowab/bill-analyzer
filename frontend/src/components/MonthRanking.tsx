import { Segmented, Tag, Spin, Empty } from 'antd'
import { useEffect, useState } from 'react'
import { getBills } from '@/api/bills'
import type { Transaction } from '@/types'

interface Props {
  year: number
  month: number
}

const RANK_COLORS = ['#f5a623', '#a0a0a0', '#cd7f32']

export default function MonthRanking({ year, month }: Props) {
  const [flowType, setFlowType] = useState<'expense' | 'income'>('expense')
  const [items, setItems] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    getBills({ period: 'month', year, month, flow_type: flowType, sort_by: 'amount', size: 1000 })
      .then((res) => setItems(res.items))
      .finally(() => setLoading(false))
  }, [year, month, flowType])

  const max = items[0] ? Number(items[0].amount) : 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 13, color: '#888' }}>共 {items.length} 条</span>
        <Segmented
          size="small"
          value={flowType}
          onChange={(v) => setFlowType(v as 'expense' | 'income')}
          options={[{ label: '支出', value: 'expense' }, { label: '收入', value: 'income' }]}
        />
      </div>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spin />
        </div>
      ) : items.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 380, paddingRight: 2 }}>
          {items.map((tx, idx) => {
            const amount = Number(tx.amount)
            const pct = (amount / max) * 100
            const isTop3 = idx < 3
            const rankColor = idx < 3 ? RANK_COLORS[idx] : '#d9d9d9'
            const barColor = flowType === 'expense' ? '#f0a958' : '#5abeaa'

            return (
              <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* 排名 */}
                <div style={{
                  width: 20,
                  height: 20,
                  borderRadius: 6,
                  background: isTop3 ? rankColor : '#f5f5f5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  color: isTop3 ? '#fff' : '#bbb',
                  flexShrink: 0,
                }}>
                  {idx + 1}
                </div>

                {/* 商家 + 进度条 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: '#333',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '60%',
                    }}>
                      {tx.merchant || tx.description || '-'}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: barColor, flexShrink: 0 }}>
                      ¥{amount.toFixed(2)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ flex: 1, height: 4, background: '#f0f0f0', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: barColor,
                        borderRadius: 2,
                        transition: 'width 0.4s ease',
                        opacity: 0.75,
                      }} />
                    </div>
                    {tx.category && (
                      <Tag bordered={false} color="default" style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px', flexShrink: 0 }}>
                        {tx.category}
                      </Tag>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
