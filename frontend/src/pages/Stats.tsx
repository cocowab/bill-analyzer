import { Card, Row, Col, Select, DatePicker } from 'antd'
import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import dayjs from 'dayjs'
import { getTimeline, getCategoryStats, getSummary } from '@/api/bills'
import type { TimelinePoint, CategoryStat, PeriodSummary } from '@/types'

const { Option } = Select

export default function Stats() {
  const [period, setPeriod] = useState('month')
  const [year, setYear] = useState(dayjs().year())
  const [month, setMonth] = useState(dayjs().month() + 1)
  const [timeline, setTimeline] = useState<TimelinePoint[]>([])
  const [categories, setCategories] = useState<CategoryStat[]>([])
  const [summary, setSummary] = useState<PeriodSummary | null>(null)

  useEffect(() => {
    getTimeline({ period: 'month', start: `${year - 1}-${String(month).padStart(2, '0')}`, end: `${year}-${String(month).padStart(2, '0')}` })
      .then(setTimeline)
    getCategoryStats({ period, year, month })
      .then(setCategories)
    getSummary({ period, year, month })
      .then(setSummary)
  }, [period, year, month])

  const lineOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['收入', '支出'] },
    xAxis: { type: 'category', data: timeline.map((t) => t.date) },
    yAxis: { type: 'value', axisLabel: { formatter: '¥{value}' } },
    series: [
      { name: '收入', type: 'line', smooth: true, data: timeline.map((t) => t.income), itemStyle: { color: '#52c41a' } },
      { name: '支出', type: 'line', smooth: true, data: timeline.map((t) => t.expense), itemStyle: { color: '#ff4d4f' } },
    ],
  }

  const pieOption = {
    tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
    legend: { orient: 'vertical', right: 10, top: 'center' },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
        data: categories.map((c) => ({ name: c.category, value: c.amount.toFixed(2) })),
      },
    ],
  }

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col>
          <Select value={period} onChange={setPeriod} style={{ width: 100 }}>
            <Option value="year">按年</Option>
            <Option value="month">按月</Option>
          </Select>
        </Col>
        <Col>
          <DatePicker
            picker={period === 'year' ? 'year' : 'month'}
            value={dayjs(`${year}-${String(month).padStart(2, '0')}`)}
            onChange={(d) => { if (d) { setYear(d.year()); setMonth(d.month() + 1) } }}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card title="收支趋势（近12个月）">
            <ReactECharts option={lineOption} style={{ height: 300 }} />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title={`${year}年${month}月 消费分类`}>
            {categories.length > 0
              ? <ReactECharts option={pieOption} style={{ height: 320 }} />
              : <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无数据</div>
            }
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title={`${year}年${month}月 收支汇总`}>
            <div style={{ padding: '16px 0' }}>
              <div style={{ marginBottom: 12, fontSize: 16 }}>
                收入：<span style={{ color: '#52c41a', fontWeight: 600 }}>¥{(summary?.income ?? 0).toFixed(2)}</span>
              </div>
              <div style={{ marginBottom: 12, fontSize: 16 }}>
                支出：<span style={{ color: '#ff4d4f', fontWeight: 600 }}>¥{(summary?.expense ?? 0).toFixed(2)}</span>
              </div>
              <div style={{ fontSize: 16 }}>
                结余：<span style={{ color: '#1677ff', fontWeight: 600 }}>¥{(summary?.balance ?? 0).toFixed(2)}</span>
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
