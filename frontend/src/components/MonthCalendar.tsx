import { Modal, Tag, Spin, Empty, Divider } from 'antd'
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons'
import { useState } from 'react'
import dayjs from 'dayjs'
import { getBills } from '@/api/bills'
import type { TimelinePoint, Transaction } from '@/types'

interface Props {
  year: number
  month: number
  dailyData: TimelinePoint[]
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

export default function MonthCalendar({ year, month, dailyData }: Props) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [dayTxs, setDayTxs] = useState<Transaction[]>([])
  const [modalLoading, setModalLoading] = useState(false)

  const dataMap = new Map<string, { income: number; expense: number }>()
  for (const p of dailyData) {
    dataMap.set(p.date, { income: Number(p.income), expense: Number(p.expense) })
  }

  const firstDay = dayjs(`${year}-${String(month).padStart(2, '0')}-01`)
  const daysInMonth = firstDay.daysInMonth()
  const startOffset = firstDay.day()

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const today = dayjs()
  const isCurrentMonth = today.year() === year && today.month() + 1 === month

  const handleDayClick = async (day: number) => {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const info = dataMap.get(key)
    if (!info || (info.income === 0 && info.expense === 0)) return

    setSelectedDay(day)
    setModalLoading(true)
    setDayTxs([])
    try {
      const res = await getBills({ period: 'day', year, month, day, size: 100 })
      setDayTxs(res.items)
    } finally {
      setModalLoading(false)
    }
  }

  return (
    <>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        {/* 星期头 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 6 }}>
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              style={{
                textAlign: 'center',
                fontSize: 12,
                color: i === 0 || i === 6 ? '#ffb347' : '#bbb',
                padding: '2px 0 6px',
                fontWeight: 500,
              }}
            >
              {w}
            </div>
          ))}
        </div>

        {/* 日期格子 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {cells.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} />

            const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const info = dataMap.get(key)
            const hasData = info && (info.income > 0 || info.expense > 0)
            const isToday = isCurrentMonth && today.date() === day
            const isWeekend = (startOffset + day - 1) % 7 === 0 || (startOffset + day - 1) % 7 === 6

            return (
              <div
                key={`day-${day}`}
                onClick={() => hasData && handleDayClick(day)}
                style={{
                  borderRadius: 10,
                  padding: '7px 2px 6px',
                  textAlign: 'center',
                  cursor: hasData ? 'pointer' : 'default',
                  background: isToday
                    ? 'linear-gradient(135deg, #1677ff, #4096ff)'
                    : hasData
                    ? '#eef6ff'
                    : '#f7f8fa',
                  boxShadow: isToday ? '0 2px 8px rgba(22,119,255,0.35)' : 'none',
                  transition: 'transform 0.12s, box-shadow 0.12s',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 3,
                  aspectRatio: '1 / 1.15',
                }}
                onMouseEnter={(e) => {
                  if (hasData) {
                    (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.05)'
                    if (!isToday) (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'
                  if (!isToday) (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: isToday ? 700 : 500,
                    color: isToday ? '#fff' : isWeekend ? '#ffb347' : '#333',
                    lineHeight: 1,
                  }}
                >
                  {day}
                </span>
                {info && info.expense > 0 && (
                  <span
                    style={{
                      fontSize: 10,
                      color: isToday ? 'rgba(255,255,255,0.9)' : '#f0a958',
                      lineHeight: 1,
                      fontWeight: 500,
                    }}
                  >
                    -{info.expense >= 1000 ? `${(info.expense / 1000).toFixed(1)}k` : info.expense.toFixed(0)}
                  </span>
                )}
                {info && info.income > 0 && (
                  <span
                    style={{
                      fontSize: 10,
                      color: isToday ? 'rgba(255,255,255,0.9)' : '#5abeaa',
                      lineHeight: 1,
                      fontWeight: 500,
                    }}
                  >
                    +{info.income >= 1000 ? `${(info.income / 1000).toFixed(1)}k` : info.income.toFixed(0)}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 日详情 Modal */}
      <Modal
        title={
          <span style={{ fontWeight: 600 }}>
            {year}年{month}月{selectedDay}日
          </span>
        }
        open={selectedDay !== null}
        onCancel={() => setSelectedDay(null)}
        footer={null}
        width={460}
        styles={{ body: { padding: '12px 20px 20px' } }}
      >
        {modalLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : dayTxs.length === 0 ? (
          <Empty description="暂无数据" />
        ) : (
          <div>
            {/* 日汇总 */}
            {(() => {
              const income = dayTxs.filter(t => t.flow_type === 'income').reduce((s, t) => s + Number(t.amount), 0)
              const expense = dayTxs.filter(t => t.flow_type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
              return (
                <div style={{ display: 'flex', gap: 16, marginBottom: 14, padding: '10px 14px', background: '#f7f8fa', borderRadius: 10 }}>
                  {income > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#5abeaa', display: 'inline-block' }} />
                      <span style={{ color: '#666', fontSize: 12 }}>收入</span>
                      <span style={{ color: '#5abeaa', fontSize: 14, fontWeight: 600 }}>¥{income.toFixed(2)}</span>
                    </div>
                  )}
                  {expense > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f0a958', display: 'inline-block' }} />
                      <span style={{ color: '#666', fontSize: 12 }}>支出</span>
                      <span style={{ color: '#f0a958', fontSize: 14, fontWeight: 600 }}>¥{expense.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* 条目列表 */}
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              {dayTxs.map((tx, idx) => (
                <div key={tx.id}>
                  {idx > 0 && <Divider style={{ margin: '6px 0' }} />}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
                    {/* 分类色块 */}
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: tx.flow_type === 'income' ? 'rgba(90,190,170,0.12)' : 'rgba(240,169,88,0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        fontSize: 11,
                        color: tx.flow_type === 'income' ? '#5abeaa' : '#f0a958',
                        fontWeight: 600,
                      }}
                    >
                      {(tx.category || '其他').slice(0, 2)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#222', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tx.merchant || tx.description || '-'}
                      </div>
                      <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>
                        {tx.category && (
                          <Tag bordered={false} color="default" style={{ fontSize: 10, padding: '0 5px', marginRight: 4, lineHeight: '16px' }}>
                            {tx.category}
                          </Tag>
                        )}
                        {dayjs(tx.date).format('HH:mm')}
                      </div>
                    </div>
                    <span style={{
                      fontWeight: 600,
                      fontSize: 15,
                      color: tx.flow_type === 'income' ? '#5abeaa' : '#f0a958',
                      flexShrink: 0,
                    }}>
                      {tx.flow_type === 'income' ? '+' : '-'}¥{Number(tx.amount).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
