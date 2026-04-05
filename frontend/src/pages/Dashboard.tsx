import { Card, Row, Col, Statistic } from 'antd'
import { ArrowUpOutlined, ArrowDownOutlined, WalletOutlined } from '@ant-design/icons'
import { useEffect, useState } from 'react'
import { getSummary } from '@/api/bills'
import type { PeriodSummary } from '@/types'
import dayjs from 'dayjs'

export default function Dashboard() {
  const [summary, setSummary] = useState<PeriodSummary | null>(null)

  useEffect(() => {
    const now = dayjs()
    getSummary({ period: 'month', year: now.year(), month: now.month() + 1 })
      .then(setSummary)
      .catch(console.error)
  }, [])

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title={`${dayjs().format('YYYY年MM月')} 收入`}
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
              title={`${dayjs().format('YYYY年MM月')} 支出`}
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
              title={`${dayjs().format('YYYY年MM月')} 结余`}
              value={summary?.balance ?? 0}
              precision={2}
              prefix={<WalletOutlined />}
              suffix="元"
              valueStyle={{ color: (summary?.balance ?? 0) >= 0 ? '#1677ff' : '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card title="功能导航">
            <p>请使用左侧菜单导航到各功能模块：</p>
            <ul>
              <li><strong>账单明细</strong>：按年/月/周查看所有交易记录</li>
              <li><strong>统计分析</strong>：折线图趋势 + 消费分类饼图</li>
              <li><strong>AI 消费分析</strong>：基于你的数据生成个性化分析报告</li>
              <li><strong>导入账单</strong>：上传微信/支付宝 CSV 或账单图片</li>
            </ul>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
