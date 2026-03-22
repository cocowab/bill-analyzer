import { Card, Row, Col, Select, DatePicker, Switch, Statistic } from 'antd'
import { ArrowUpOutlined, ArrowDownOutlined, WalletOutlined } from '@ant-design/icons'
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
  const [showBalance, setShowBalance] = useState(false)

  useEffect(() => {
    const monthStr = `${year}-${String(month).padStart(2, '0')}`
    const timelineParams = period === 'year'
      ? { period: 'month', start: `${year}-01`, end: `${year}-12` }
      : { period: 'day', start: monthStr, end: monthStr }
    getTimeline(timelineParams).then(setTimeline)
    getCategoryStats({ period, year, month: period === 'month' ? month : undefined }).then(setCategories)
    getSummary({ period, year, month: period === 'month' ? month : undefined }).then(setSummary)
  }, [period, year, month])

  const lineOption = showBalance
    ? {
        tooltip: { trigger: 'axis', valueFormatter: (v: number) => `¥${v.toFixed(2)}` },
        legend: { data: ['结余'] },
        xAxis: { type: 'category', data: timeline.map((t) => t.date) },
        yAxis: { type: 'value', axisLabel: { formatter: '¥{value}' } },
        series: [
          {
            name: '结余',
            type: 'line',
            smooth: true,
            data: timeline.map((t) => +(t.income - t.expense).toFixed(2)),
            itemStyle: { color: '#1677ff' },
            areaStyle: { color: 'rgba(22,119,255,0.08)' },
          },
        ],
      }
    : {
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

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="收入"
              value={summary?.income ?? 0}
              precision={2}
              prefix={<ArrowUpOutlined style={{ color: '#52c41a' }} />}
              suffix="元"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="支出"
              value={summary?.expense ?? 0}
              precision={2}
              prefix={<ArrowDownOutlined style={{ color: '#ff4d4f' }} />}
              suffix="元"
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="结余"
              value={summary?.balance ?? 0}
              precision={2}
              prefix={<WalletOutlined />}
              suffix="元"
              valueStyle={{ color: (summary?.balance ?? 0) >= 0 ? '#1677ff' : '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card
            title={period === 'year' ? `${year}年 月度收支趋势` : `${year}年${month}月 每日收支趋势`}
            extra={<Switch checkedChildren="结余" unCheckedChildren="收支" checked={showBalance} onChange={setShowBalance} />}
          >
            <ReactECharts option={lineOption} notMerge style={{ height: 300 }} />
          </Card>
        </Col>
        <Col span={24}>
          <Card title={period === 'year' ? `${year}年 消费分类` : `${year}年${month}月 消费分类`}>
            {categories.length > 0
              ? <ReactECharts option={pieOption} style={{ height: 320 }} />
              : <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无数据</div>
            }
          </Card>
        </Col>
      </Row>
    </div>
  )
}
