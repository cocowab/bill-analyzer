import { Card, Row, Col, Select, DatePicker, Switch, Statistic, Segmented, Space } from 'antd'
import { ArrowUpOutlined, ArrowDownOutlined, WalletOutlined } from '@ant-design/icons'
import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import dayjs from 'dayjs'
import { getTimeline, getCategoryStats, getSummary } from '@/api/bills'
import type { TimelinePoint, CategoryStat, PeriodSummary } from '@/types'
import MonthCalendar from '@/components/MonthCalendar'
import MonthRanking from '@/components/MonthRanking'

const { Option } = Select

const CARD_STYLE = { borderRadius: 12, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }

export default function Stats() {
  const [period, setPeriod] = useState('month')
  const [year, setYear] = useState(dayjs().year())
  const [month, setMonth] = useState(dayjs().month() + 1)
  const [timeline, setTimeline] = useState<TimelinePoint[]>([])
  const [categories, setCategories] = useState<CategoryStat[]>([])
  const [summary, setSummary] = useState<PeriodSummary | null>(null)
  const [showBalance, setShowBalance] = useState(false)
  const [chartType, setChartType] = useState<'line' | 'bar'>('line')
  const [pieFlowType, setPieFlowType] = useState<'expense' | 'income'>('expense')

  useEffect(() => {
    const monthStr = `${year}-${String(month).padStart(2, '0')}`
    const timelineParams = period === 'year'
      ? { period: 'month', start: `${year}-01`, end: `${year}-12` }
      : { period: 'day', start: monthStr, end: monthStr }
    getTimeline(timelineParams).then(setTimeline)
    getSummary({ period, year, month: period === 'month' ? month : undefined }).then(setSummary)
  }, [period, year, month])

  useEffect(() => {
    getCategoryStats({ period, year, month: period === 'month' ? month : undefined, flow_type: pieFlowType }).then(setCategories)
  }, [period, year, month, pieFlowType])

  const isLine = chartType === 'line'

  const chartOption = (() => {
    const base = {
      tooltip: { trigger: 'axis', valueFormatter: (v: number) => `¥${v.toFixed(2)}` },
      grid: { left: 16, right: 16, top: 40, bottom: 0, containLabel: true },
      xAxis: { type: 'category', data: timeline.map((t) => t.date), axisLine: { lineStyle: { color: '#e8e8e8' } } },
      yAxis: { type: 'value', axisLabel: { formatter: '¥{value}' }, splitLine: { lineStyle: { color: '#f5f5f5' } } },
    }
    if (showBalance) {
      return {
        ...base,
        legend: { data: ['结余'] },
        series: [{
          name: '结余',
          type: chartType,
          smooth: true,
          data: timeline.map((t) => +(t.income - t.expense).toFixed(2)),
          itemStyle: { color: '#1677ff' },
          ...(isLine ? { lineStyle: { width: 2.5 }, areaStyle: { color: 'rgba(22,119,255,0.08)' }, symbol: 'circle', symbolSize: 6 } : { barMaxWidth: 40, borderRadius: [4, 4, 0, 0] }),
        }],
      }
    }
    const incomeColor = isLine ? '#52c41a' : '#5abeaa'
    const expenseColor = isLine ? '#ff4d4f' : '#f0a958'
    return {
      ...base,
      legend: { data: ['收入', '支出'] },
      series: [
        {
          name: '收入',
          type: chartType,
          smooth: true,
          data: timeline.map((t) => t.income),
          itemStyle: { color: incomeColor },
          ...(isLine ? { lineStyle: { width: 2.5 }, areaStyle: { color: 'rgba(82,196,26,0.06)' }, symbol: 'circle', symbolSize: 5 } : { barMaxWidth: 24, borderRadius: [4, 4, 0, 0] }),
        },
        {
          name: '支出',
          type: chartType,
          smooth: true,
          data: timeline.map((t) => t.expense),
          itemStyle: { color: expenseColor },
          ...(isLine ? { lineStyle: { width: 2.5 }, areaStyle: { color: 'rgba(255,77,79,0.06)' }, symbol: 'circle', symbolSize: 5 } : { barMaxWidth: 24, borderRadius: [4, 4, 0, 0] }),
        },
      ],
    }
  })()

  const pieOption = {
    tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
    legend: { orient: 'vertical', right: 10, top: 'center', itemGap: 10 },
    series: [
      {
        type: 'pie',
        radius: ['42%', '68%'],
        center: ['38%', '50%'],
        avoidLabelOverlap: false,
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 14, fontWeight: 'bold' },
          itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.15)' },
        },
        data: categories.map((c) => ({ name: c.category, value: c.amount.toFixed(2) })),
      },
    ],
  }

  const balance = summary?.balance ?? 0

  return (
    <div>
      {/* 时间筛选 */}
      <Card style={{ ...CARD_STYLE, marginBottom: 16 }} styles={{ body: { padding: '14px 20px' } }}>
        <Row gutter={12} align="middle">
          <Col>
            <Select value={period} onChange={setPeriod} style={{ width: 90 }}>
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
      </Card>

      {/* 汇总卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card style={CARD_STYLE} styles={{ body: { padding: '20px 24px' } }}>
            <Statistic
              title={<span style={{ color: '#888', fontSize: 13 }}>收入</span>}
              value={summary?.income ?? 0}
              precision={2}
              prefix={<ArrowUpOutlined style={{ color: '#52c41a', fontSize: 14 }} />}
              suffix={<span style={{ fontSize: 13, fontWeight: 400 }}>元</span>}
              valueStyle={{ color: '#52c41a', fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={CARD_STYLE} styles={{ body: { padding: '20px 24px' } }}>
            <Statistic
              title={<span style={{ color: '#888', fontSize: 13 }}>支出</span>}
              value={summary?.expense ?? 0}
              precision={2}
              prefix={<ArrowDownOutlined style={{ color: '#ff4d4f', fontSize: 14 }} />}
              suffix={<span style={{ fontSize: 13, fontWeight: 400 }}>元</span>}
              valueStyle={{ color: '#ff4d4f', fontSize: 24 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={CARD_STYLE} styles={{ body: { padding: '20px 24px' } }}>
            <Statistic
              title={<span style={{ color: '#888', fontSize: 13 }}>结余</span>}
              value={balance}
              precision={2}
              prefix={<WalletOutlined style={{ color: balance >= 0 ? '#1677ff' : '#ff4d4f', fontSize: 14 }} />}
              suffix={<span style={{ fontSize: 13, fontWeight: 400 }}>元</span>}
              valueStyle={{ color: balance >= 0 ? '#1677ff' : '#ff4d4f', fontSize: 24 }}
            />
          </Card>
        </Col>
      </Row>

      {/* 趋势图 */}
      <Card
        style={{ ...CARD_STYLE, marginBottom: 16 }}
        title={
          <span style={{ fontWeight: 600 }}>
            {period === 'year' ? `${year}年 月度趋势` : `${year}年${month}月 每日趋势`}
          </span>
        }
        extra={
          <Space size={8}>
            <Segmented
              size="small"
              value={chartType}
              onChange={(v) => setChartType(v as 'line' | 'bar')}
              options={[{ label: '折线', value: 'line' }, { label: '柱状', value: 'bar' }]}
            />
            <Switch
              checkedChildren="结余"
              unCheckedChildren="收支"
              checked={showBalance}
              onChange={setShowBalance}
            />
          </Space>
        }
      >
        <ReactECharts option={chartOption} notMerge style={{ height: 300 }} />
      </Card>

      {/* 月度日历 + 排行 */}
      {period === 'month' && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={24} lg={13}>
            <Card
              style={{ ...CARD_STYLE, height: '100%' }}
              title={<span style={{ fontWeight: 600 }}>{year}年{month}月 日历</span>}
              styles={{ body: { padding: '12px 20px 16px' } }}
            >
              <MonthCalendar year={year} month={month} dailyData={timeline} />
            </Card>
          </Col>
          <Col xs={24} lg={11}>
            <Card
              style={{ ...CARD_STYLE, height: '100%' }}
              title={<span style={{ fontWeight: 600 }}>本月排行</span>}
              styles={{ body: { padding: '12px 20px 16px' } }}
            >
              <MonthRanking year={year} month={month} />
            </Card>
          </Col>
        </Row>
      )}

      {/* 分类饼图 */}
      <Card
        style={CARD_STYLE}
        title={
          <span style={{ fontWeight: 600 }}>
            {period === 'year' ? `${year}年 分类占比` : `${year}年${month}月 分类占比`}
          </span>
        }
        extra={
          <Segmented
            value={pieFlowType}
            onChange={(v) => setPieFlowType(v as 'expense' | 'income')}
            options={[{ label: '支出', value: 'expense' }, { label: '收入', value: 'income' }]}
          />
        }
      >
        {categories.length > 0
          ? <ReactECharts option={pieOption} notMerge style={{ height: 320 }} />
          : <div style={{ textAlign: 'center', padding: 48, color: '#bbb' }}>暂无数据</div>
        }
      </Card>
    </div>
  )
}
