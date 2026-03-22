import { Table, Tag, Select, DatePicker, Row, Col, Card, Button, Popconfirm, message, Space, Typography } from 'antd'
import { FilterOutlined, DeleteOutlined } from '@ant-design/icons'
import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
dayjs.extend(isoWeek)
import { getBills, deleteBill } from '@/api/bills'
import type { Transaction, PeriodType } from '@/types'

const { Option } = Select
const { Text } = Typography

const FLOW_COLOR = { income: 'success', expense: 'error' } as const
const FLOW_LABEL = { income: '收入', expense: '支出' } as const

export default function Bills() {
  const [period, setPeriod] = useState<PeriodType>('month')
  const [year, setYear] = useState(dayjs().year())
  const [month, setMonth] = useState(dayjs().month() + 1)
  const [week, setWeek] = useState(() => dayjs().isoWeek())
  const [flowType, setFlowType] = useState<string | undefined>()
  const [data, setData] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  const fetchData = () => {
    setLoading(true)
    getBills({
      period,
      year,
      month: period === 'month' ? month : undefined,
      week: period === 'week' ? week : undefined,
      flow_type: flowType,
      page,
      size: 20,
    })
      .then((res) => {
        setData(res.items)
        setTotal(res.total)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [period, year, month, week, flowType, page])

  const handleDelete = async (id: number) => {
    await deleteBill(id)
    message.success('已删除')
    fetchData()
  }

  const columns = [
    {
      title: '时间',
      dataIndex: 'date',
      width: 160,
      render: (v: string) => (
        <Text type="secondary" style={{ fontSize: 13 }}>{dayjs(v).format('MM-DD HH:mm')}</Text>
      ),
    },
    {
      title: '类型',
      dataIndex: 'flow_type',
      width: 72,
      render: (v: keyof typeof FLOW_LABEL) => (
        <Tag color={FLOW_COLOR[v]} style={{ marginRight: 0 }}>{FLOW_LABEL[v]}</Tag>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      width: 100,
      render: (v: string) => v ? <Tag bordered={false} color="blue">{v}</Tag> : <Text type="secondary">-</Text>,
    },
    { title: '商家', dataIndex: 'merchant', ellipsis: true },
    { title: '商品/描述', dataIndex: 'description', ellipsis: true },
    {
      title: '金额',
      dataIndex: 'amount',
      width: 120,
      align: 'right' as const,
      render: (v: number, row: Transaction) => (
        <span style={{ color: row.flow_type === 'income' ? '#52c41a' : '#ff4d4f', fontWeight: 600, fontSize: 15 }}>
          {row.flow_type === 'income' ? '+' : '-'}¥{Number(v).toFixed(2)}
        </span>
      ),
    },
    {
      title: '来源',
      dataIndex: 'source',
      width: 80,
      render: (v: string) => (
        <Tag bordered={false} color="default">
          {({ wechat: '微信', alipay: '支付宝', image: '图片', manual: '手动' } as Record<string, string>)[v] ?? v}
        </Tag>
      ),
    },
    {
      title: '操作',
      width: 60,
      render: (_: unknown, row: Transaction) => (
        <Popconfirm title="确认删除该条记录？" onConfirm={() => handleDelete(row.id)} okText="删除" okButtonProps={{ danger: true }}>
          <Button type="text" danger icon={<DeleteOutlined />} size="small" />
        </Popconfirm>
      ),
    },
  ]

  return (
    <div>
      <Card
        styles={{ body: { padding: '16px 20px' } }}
        style={{ borderRadius: 12, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
      >
        <Row gutter={12} align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Space size={4} align="center">
              <FilterOutlined style={{ color: '#999' }} />
              <span style={{ color: '#666', fontSize: 13 }}>筛选</span>
            </Space>
          </Col>
          <Col>
            <Select value={period} onChange={(v) => { setPeriod(v); setPage(1) }} style={{ width: 90 }}>
              <Option value="year">按年</Option>
              <Option value="month">按月</Option>
              <Option value="week">按周</Option>
            </Select>
          </Col>
          {period !== 'week' && (
            <Col>
              <DatePicker
                picker={period === 'year' ? 'year' : 'month'}
                value={dayjs(`${year}-${String(month).padStart(2, '0')}`)}
                onChange={(d) => { if (d) { setYear(d.year()); setMonth(d.month() + 1); setPage(1) } }}
              />
            </Col>
          )}
          {period === 'week' && (
            <Col>
              <DatePicker
                picker="week"
                value={dayjs().year(year).isoWeek(week)}
                onChange={(d) => { if (d) { setYear(d.isoWeekYear()); setWeek(d.isoWeek()); setPage(1) } }}
              />
            </Col>
          )}
          <Col>
            <Select
              placeholder="收支类型"
              allowClear
              style={{ width: 110 }}
              onChange={(v) => { setFlowType(v); setPage(1) }}
            >
              <Option value="income">收入</Option>
              <Option value="expense">支出</Option>
            </Select>
          </Col>
          <Col flex="auto" style={{ textAlign: 'right' }}>
            <Text type="secondary" style={{ fontSize: 13 }}>共 {total} 条记录</Text>
          </Col>
        </Row>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={{
            total,
            pageSize: 20,
            current: page,
            onChange: setPage,
            showSizeChanger: false,
            size: 'small',
          }}
          scroll={{ x: 860 }}
          size="middle"
          rowClassName={(_, index) => index % 2 === 1 ? 'table-row-stripe' : ''}
        />
      </Card>
    </div>
  )
}
