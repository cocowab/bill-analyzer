import { Table, Tag, Select, DatePicker, Row, Col, Card, Button, Popconfirm, message, Space, Typography, Modal, Form, Input, InputNumber } from 'antd'
import { FilterOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons'
import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
dayjs.extend(isoWeek)
import { getBills, deleteBill, updateBill } from '@/api/bills'
import type { Transaction, PeriodType } from '@/types'

const { Option } = Select
const { Text } = Typography
const { TextArea } = Input

const EXPENSE_CATEGORIES = ['餐饮美食', '购物消费', '服饰装扮', '数码家电', '运动户外', '美容美发', '交通出行', '酒店旅游', '娱乐休闲', '医疗健康', '住房租赁', '教育学习', '生活缴费', '转账红包', '其他']
const INCOME_CATEGORIES = ['工资收入', '红包收入', '理财收益', '退款收入', '收款转账', '其他收入']
const FLOW_TYPE_OPTIONS = [{ label: '支出', value: 'expense' }, { label: '收入', value: 'income' }]

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
  const [editRecord, setEditRecord] = useState<Transaction | null>(null)
  const [editFlowType, setEditFlowType] = useState<string>('expense')
  const [editForm] = Form.useForm()

  const handleEdit = (record: Transaction) => {
    setEditRecord(record)
    setEditFlowType(record.flow_type)
    editForm.setFieldsValue({
      ...record,
      date: dayjs(record.date),
    })
  }

  const handleEditSave = async () => {
    try {
      const values = await editForm.validateFields()
      await updateBill(editRecord!.id, {
        ...values,
        date: values.date.toISOString(),
        amount: Number(values.amount),
      })
      message.success('已更新')
      setEditRecord(null)
      fetchData()
    } catch {}
  }

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
      width: 90,
      render: (_: unknown, row: Transaction) => (
        <Space size={0}>
          <Button type="text" icon={<EditOutlined />} size="small" onClick={() => handleEdit(row)} />
          <Popconfirm title="确认删除该条记录？" onConfirm={() => handleDelete(row.id)} okText="删除" okButtonProps={{ danger: true }}>
            <Button type="text" danger icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        </Space>
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
      <Modal
        title="编辑账单"
        open={!!editRecord}
        onOk={handleEditSave}
        onCancel={() => setEditRecord(null)}
        width={800}
        okText="保存"
      >
        <Form
          form={editForm}
          layout="vertical"
          onValuesChange={(changed) => {
            if ('flow_type' in changed) {
              setEditFlowType(changed.flow_type)
              editForm.setFieldValue('category', undefined)
            }
          }}
        >
          <Row gutter={[24, 0]}>
            <Col span={12}>
              <Form.Item label="类型" name="flow_type" rules={[{ required: true, message: '请选择类型' }]}>
                <Select options={FLOW_TYPE_OPTIONS} />
              </Form.Item>
              <Form.Item label="日期" name="date" rules={[{ required: true, message: '请选择日期' }]}>
                <DatePicker showTime style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="商户" name="merchant">
                <Input placeholder="可选" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="金额" name="amount" rules={[{ required: true, message: '请输入金额' }]}>
                <InputNumber precision={2} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="分类" name="category" rules={[{ required: true, message: '请选择分类' }]}>
                <Select
                  options={(editFlowType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => ({ label: c, value: c }))}
                  placeholder="请选择"
                />
              </Form.Item>
              {editFlowType === 'expense' && (
                <Form.Item label="支付方式" name="payment_method">
                  <Input placeholder="可选" />
                </Form.Item>
              )}
            </Col>
          </Row>
          <Form.Item label="描述" name="description">
            <TextArea rows={3} placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
