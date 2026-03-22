import { Table, Tag, Select, DatePicker, Row, Col, Card, Space, Button, Popconfirm, message } from 'antd'
import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { getBills, deleteBill } from '@/api/bills'
import type { Transaction, PeriodType } from '@/types'

const { Option } = Select

const FLOW_COLOR = { income: 'green', expense: 'red' } as const
const FLOW_LABEL = { income: '收入', expense: '支出' } as const

export default function Bills() {
  const [period, setPeriod] = useState<PeriodType>('month')
  const [year, setYear] = useState(dayjs().year())
  const [month, setMonth] = useState(dayjs().month() + 1)
  const [flowType, setFlowType] = useState<string | undefined>()
  const [data, setData] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  const fetchData = () => {
    setLoading(true)
    getBills({ period, year, month, flow_type: flowType, page, size: 20 })
      .then((res) => {
        setData(res.items)
        setTotal(res.total)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [period, year, month, flowType, page])

  const handleDelete = async (id: number) => {
    await deleteBill(id)
    message.success('已删除')
    fetchData()
  }

  const columns = [
    {
      title: '时间',
      dataIndex: 'date',
      width: 180,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '类型',
      dataIndex: 'flow_type',
      width: 80,
      render: (v: keyof typeof FLOW_LABEL) => (
        <Tag color={FLOW_COLOR[v]}>{FLOW_LABEL[v]}</Tag>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      width: 100,
      render: (v: string) => v || '-',
    },
    { title: '商家', dataIndex: 'merchant' },
    { title: '描述', dataIndex: 'description' },
    {
      title: '金额',
      dataIndex: 'amount',
      width: 120,
      render: (v: number, row: Transaction) => (
        <span style={{ color: row.flow_type === 'income' ? '#52c41a' : '#ff4d4f', fontWeight: 600 }}>
          {row.flow_type === 'income' ? '+' : '-'}¥{Number(v).toFixed(2)}
        </span>
      ),
    },
    {
      title: '来源',
      dataIndex: 'source',
      width: 80,
      render: (v: string) => ({ wechat: '微信', alipay: '支付宝', image: '图片', manual: '手动' }[v] ?? v),
    },
    {
      title: '操作',
      width: 80,
      render: (_: unknown, row: Transaction) => (
        <Popconfirm title="确认删除？" onConfirm={() => handleDelete(row.id)}>
          <Button type="link" danger size="small">删除</Button>
        </Popconfirm>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Row gutter={12} style={{ marginBottom: 16 }}>
          <Col>
            <Select value={period} onChange={setPeriod} style={{ width: 100 }}>
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
                onChange={(d) => {
                  if (d) {
                    setYear(d.year())
                    setMonth(d.month() + 1)
                  }
                }}
              />
            </Col>
          )}
          <Col>
            <Select
              placeholder="收支类型"
              allowClear
              style={{ width: 120 }}
              onChange={setFlowType}
            >
              <Option value="income">收入</Option>
              <Option value="expense">支出</Option>
            </Select>
          </Col>
        </Row>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={{ total, pageSize: 20, current: page, onChange: setPage }}
          scroll={{ x: 900 }}
        />
      </Card>
    </div>
  )
}
