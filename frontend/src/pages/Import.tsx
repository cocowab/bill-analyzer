import {
  Card, Upload, message, Tabs, Alert, Space, Typography, theme, Button,
  Modal, Form, Input, DatePicker, Select, Table, InputNumber, Spin, Popconfirm, Row, Col
} from 'antd'
import { InboxOutlined, LoadingOutlined, QuestionCircleOutlined, PlusOutlined } from '@ant-design/icons'
import { useState, useRef } from 'react'
import { uploadCSV, uploadImage } from '@/api/bills'
import dayjs from 'dayjs'

const { Dragger } = Upload
const { Text } = Typography
const { TextArea } = Input

const CARD_STYLE = { borderRadius: 12, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }

const FLOW_TYPE_OPTIONS = [
  { label: '支出', value: 'expense' },
  { label: '收入', value: 'income' },
]

const EXPENSE_CATEGORIES = ['餐饮美食', '购物消费', '服饰装扮', '数码家电', '运动户外', '美容美发', '交通出行', '酒店旅游', '娱乐休闲', '医疗健康', '住房租赁', '教育学习', '生活缴费', '转账红包', '其他']
const INCOME_CATEGORIES = ['工资收入', '红包收入', '理财收益', '退款收入', '收款转账', '其他收入']

interface Transaction {
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
  source: string
}

// 模块级缓存，切换页面不丢失 OCR 预览弹窗状态
let cachedOcrData: Transaction[] = []
let cachedOcrEditing: Record<number, Transaction> = {}
let cachedShowOcrModal = false

export default function Import() {
  const [csvLoading, setCsvLoading] = useState(false)
  const [showOcrLoading, setShowOcrLoading] = useState(false)
  const [showCsvGuide, setShowCsvGuide] = useState(false)
  const [showManualModal, setShowManualModal] = useState(false)
  const [showOcrModal, setShowOcrModal] = useState(cachedShowOcrModal)
  const [ocrData, setOcrData] = useState<Transaction[]>(cachedOcrData)
  const [ocrEditing, setOcrEditing] = useState<Record<number, Transaction>>(cachedOcrEditing)
  const [ocrSaving, setOcrSaving] = useState(false)
  const [manualFlowType, setManualFlowType] = useState<'income' | 'expense'>('expense')
  const [form] = Form.useForm()
  const { token } = theme.useToken()
  const abortControllerRef = useRef<AbortController | null>(null)

  const updateOcrData = (data: Transaction[]) => {
    cachedOcrData = data
    setOcrData(data)
  }

  const updateOcrEditing = (editing: Record<number, Transaction>) => {
    cachedOcrEditing = editing
    setOcrEditing(editing)
  }

  const updateShowOcrModal = (val: boolean) => {
    cachedShowOcrModal = val
    setShowOcrModal(val)
  }

  const handleCsvUpload = async (file: File) => {
    setCsvLoading(true)
    try {
      const res: any = await uploadCSV(file)
      const parts = [`共 ${res.total} 条`, `成功 ${res.success} 条`]
      if (res.skipped) parts.push(`跳过重复 ${res.skipped} 条`)
      if (res.filtered) parts.push(`过滤非收支 ${res.filtered} 条`)
      message.success(`导入完成（${res.source === 'wechat' ? '微信' : '支付宝'}）：${parts.join('，')}`)
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || '未知错误'
      message.error(`导入失败：${detail}`)
    } finally {
      setCsvLoading(false)
    }
    return false
  }

  const handleImageUpload = async (file: File) => {
    const controller = new AbortController()
    abortControllerRef.current = controller
    setShowOcrLoading(true)
    try {
      const res: any = await uploadImage(file, controller.signal)
      setShowOcrLoading(false)
      if (res.transactions && res.transactions.length > 0) {
        cachedOcrData = res.transactions
        cachedOcrEditing = {}
        cachedShowOcrModal = true
        updateOcrData(res.transactions)
        updateOcrEditing({})
        updateShowOcrModal(true)
        message.info(`识别到 ${res.recognized} 条账单数据，请确认后保存`)
      } else {
        message.warning('未识别到账单数据')
      }
    } catch (err: any) {
      setShowOcrLoading(false)
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return false
      const detail = err?.response?.data?.detail || err?.message || '未知错误'
      message.error(`识别失败：${detail}`)
    }
    return false
  }

  const handleCancelOcrLoading = () => {
    Modal.confirm({
      title: '终止识别',
      content: '确定要终止 AI 识别操作吗？',
      okText: '终止',
      okType: 'danger',
      cancelText: '继续等待',
      onOk: () => {
        abortControllerRef.current?.abort()
        setShowOcrLoading(false)
        message.info('已终止识别')
      },
    })
  }

  const handleManualCreate = async (values: any) => {
    try {
      const response = await fetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: values.date.toISOString(),
          amount: values.amount,
          flow_type: values.flow_type,
          category: values.category,
          merchant: values.merchant,
          description: values.description,
          payment_method: values.payment_method,
          source: 'manual',
        }),
      })
      if (response.ok) {
        message.success('账单已添加')
        form.resetFields()
        setShowManualModal(false)
      } else {
        message.error('添加失败')
      }
    } catch (err) {
      message.error('添加失败')
    }
  }

  const handleOcrSave = async () => {
    setOcrSaving(true)
    try {
      const txToSave = ocrData.map((tx, idx) => ocrEditing[idx] || tx)
      const response = await fetch('/api/upload/image/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: txToSave }),
      })
      const res = await response.json()
      message.success(`保存成功：${res.saved} 条，跳过 ${res.skipped} 条`)
      updateShowOcrModal(false)
      updateOcrData([])
      updateOcrEditing({})
    } catch (err) {
      message.error('保存失败')
    } finally {
      setOcrSaving(false)
    }
  }

  const draggerStyle = {
    borderRadius: 10,
    background: token.colorFillAlter,
  }

  const ocrColumns = [
    {
      title: '日期',
      dataIndex: 'date',
      width: 180,
      render: (text: string, _: any, idx: number) => {
        const val = ocrEditing[idx]?.date || text
        return (
          <DatePicker
            value={dayjs(val)}
            onChange={(d) => d && updateOcrEditing({ ...ocrEditing, [idx]: { ...ocrData[idx], ...ocrEditing[idx], date: d.toISOString() } })}
            size="small"
            style={{ width: '100%' }}
          />
        )
      },
    },
    {
      title: '金额',
      dataIndex: 'amount',
      width: 100,
      render: (text: number, _: any, idx: number) => {
        const val = ocrEditing[idx]?.amount ?? text
        return (
          <InputNumber
            value={val}
            onChange={(v) => updateOcrEditing({ ...ocrEditing, [idx]: { ...ocrData[idx], ...ocrEditing[idx], amount: v || 0 } })}
            size="small"
            precision={2}
            style={{ width: '100%' }}
          />
        )
      },
    },
    {
      title: '类型',
      dataIndex: 'flow_type',
      width: 100,
      render: (text: string, _: any, idx: number) => {
        const val = ocrEditing[idx]?.flow_type || text
        return (
          <Select
            value={val}
            onChange={(v) => {
              const defaultCategory = v === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]
              updateOcrEditing({ ...ocrEditing, [idx]: { ...ocrData[idx], ...ocrEditing[idx], flow_type: v, category: defaultCategory } })
            }}
            options={FLOW_TYPE_OPTIONS}
            size="small"
          />
        )
      },
    },
    {
      title: '分类',
      dataIndex: 'category',
      width: 140,
      render: (text: string, record: any, idx: number) => {
        const val = ocrEditing[idx]?.category || text
        const flowType = ocrEditing[idx]?.flow_type || record.flow_type
        const options = flowType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
        return (
          <Select
            value={val}
            onChange={(v) => updateOcrEditing({ ...ocrEditing, [idx]: { ...ocrData[idx], ...ocrEditing[idx], category: v } })}
            options={options.map((c) => ({ label: c, value: c }))}
            size="small"
            style={{ minWidth: 88 }}
          />
        )
      },
    },
    {
      title: '商户',
      dataIndex: 'merchant',
      width: 130,
      render: (text: string, _: any, idx: number) => {
        const val = ocrEditing[idx]?.merchant ?? text
        return (
          <Input
            value={val}
            onChange={(e) => updateOcrEditing({ ...ocrEditing, [idx]: { ...ocrData[idx], ...ocrEditing[idx], merchant: e.target.value } })}
            size="small"
          />
        )
      },
    },
    {
      title: '商品描述',
      dataIndex: 'description',
      width: 160,
      render: (text: string, _: any, idx: number) => {
        const val = ocrEditing[idx]?.description ?? text
        return (
          <Input
            value={val || ''}
            onChange={(e) => updateOcrEditing({ ...ocrEditing, [idx]: { ...ocrData[idx], ...ocrEditing[idx], description: e.target.value } })}
            size="small"
            placeholder="无"
          />
        )
      },
    },
    {
      title: '操作',
      width: 100,
      render: (_: any, __: any, idx: number) => (
        <Popconfirm
          title="删除此条"
          onConfirm={() => {
            updateOcrData(ocrData.filter((_, i) => i !== idx))
            const newEditing: Record<number, Transaction> = {}
            Object.entries(ocrEditing).forEach(([key, val]) => {
              const k = Number(key)
              if (k < idx) newEditing[k] = val
              else if (k > idx) newEditing[k - 1] = val
            })
            updateOcrEditing(newEditing)
          }}
        >
          <Button type="link" danger size="small">删除</Button>
        </Popconfirm>
      ),
    },
  ]

  const items = [
    {
      key: 'csv',
      label: '导入微信/支付宝账单',
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <div>
            <Button
              type="default"
              size="small"
              icon={<QuestionCircleOutlined />}
              onClick={() => setShowCsvGuide((v) => !v)}
              style={{ fontSize: 13, color: '#666', borderColor: '#d9d9d9' }}
            >
              如何导出微信 / 支付宝账单
            </Button>
            {showCsvGuide && (
              <Alert
                type="info"
                showIcon
                style={{ marginTop: 10 }}
                message="导出步骤"
                description={
                  <ul style={{ margin: '4px 0 0', paddingLeft: 20, lineHeight: 2 }}>
                    <li><strong>微信</strong>：微信 → 我 → 服务 → 钱包 → 账单 → 右上角省略号 → 下载账单</li>
                    <li><strong>支付宝</strong>：支付宝 → 我的 → 账单 → 右上角下载 → 选择时间范围导出</li>
                  </ul>
                }
              />
            )}
          </div>
          <Dragger
            accept=".csv,.xlsx,.xls"
            beforeUpload={handleCsvUpload}
            showUploadList={false}
            disabled={csvLoading}
            style={draggerStyle}
          >
            <p className="ant-upload-drag-icon" style={{ marginBottom: 8 }}>
              {csvLoading ? <LoadingOutlined style={{ fontSize: 40, color: token.colorPrimary }} /> : <InboxOutlined style={{ fontSize: 40 }} />}
            </p>
            <p className="ant-upload-text" style={{ fontSize: 15, fontWeight: 500 }}>
              {csvLoading ? '导入中，请稍候...' : '点击或拖拽账单文件到此区域'}
            </p>
            <p className="ant-upload-hint" style={{ color: '#999' }}>
              自动识别微信（CSV / XLSX）和支付宝（CSV）格式
            </p>
          </Dragger>
          {csvLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: token.colorPrimary, justifyContent: 'center' }}>
              <LoadingOutlined />
              <Text type="secondary">正在解析账单数据...</Text>
            </div>
          )}
        </Space>
      ),
    },
    {
      key: 'image',
      label: '识别账单图片',
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <Dragger
            accept="image/*"
            beforeUpload={handleImageUpload}
            showUploadList={false}
            style={draggerStyle}
          >
            <p className="ant-upload-drag-icon" style={{ marginBottom: 8 }}>
              <InboxOutlined style={{ fontSize: 40 }} />
            </p>
            <p className="ant-upload-text" style={{ fontSize: 15, fontWeight: 500 }}>
              点击或拖拽图片到此区域
            </p>
            <p className="ant-upload-hint" style={{ color: '#999' }}>
              支持 JPG / PNG / WebP 格式，AI 识别需约 10~30 秒
            </p>
          </Dragger>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card style={CARD_STYLE} title={<span style={{ fontWeight: 600 }}>导入账单数据</span>}>
        {/* 手动添加区域 */}
        <div style={{ padding: '16px', background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0', marginBottom: 20 }}>
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#333' }}>手动添加账单</div>
            <Button
              type="primary"
              size="middle"
              icon={<PlusOutlined />}
              onClick={() => {
                form.resetFields()
                form.setFieldsValue({ flow_type: 'expense' })
                setManualFlowType('expense')
                setShowManualModal(true)
              }}
            >
              添加单条账单数据
            </Button>
          </Space>
        </div>
        <Tabs items={items} size="large" />
      </Card>

      {/* OCR 识别中弹窗 */}
      <Modal
        title="AI 识别中"
        open={showOcrLoading}
        maskClosable={false}
        footer={null}
        onCancel={handleCancelOcrLoading}
        width={400}
      >
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 20, fontSize: 15, color: '#333' }}>正在识别账单图片，请稍候...</div>
          <div style={{ marginTop: 8, fontSize: 13, color: '#999' }}>通常需要 10 ~ 30 秒，点击右上角叉号可终止</div>
        </div>
      </Modal>

      {/* 手动添加账单弹窗 */}
      <Modal
        title="添加账单"
        open={showManualModal}
        onOk={() => form.submit()}
        onCancel={() => setShowManualModal(false)}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleManualCreate}
          onValuesChange={(changedValues) => {
            if ('flow_type' in changedValues) {
              setManualFlowType(changedValues.flow_type)
              form.setFieldValue('category', undefined)
            }
          }}
        >
          <Row gutter={[24, 0]}>
            <Col span={12}>
              <Form.Item label="类型" name="flow_type" rules={[{ required: true, message: '请选择类型' }]}>
                <Select options={FLOW_TYPE_OPTIONS} placeholder="请选择" />
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
                  options={(manualFlowType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => ({ label: c, value: c }))}
                  placeholder="请选择"
                />
              </Form.Item>
              {manualFlowType === 'expense' && (
                <Form.Item label="支付方式" name="payment_method">
                  <Input placeholder="可选" />
                </Form.Item>
              )}
            </Col>
          </Row>
          <Form.Item label="描述" name="description">
            <TextArea placeholder="可选" rows={4} />
          </Form.Item>
        </Form>
      </Modal>

      {/* OCR 预览弹窗 */}
      <Modal
        title={`账单预览（${ocrData.length} 条）`}
        open={showOcrModal}
        onOk={handleOcrSave}
        onCancel={() => updateShowOcrModal(false)}
        maskClosable={false}
        width={1200}
        okText="保存"
        cancelText="取消"
        confirmLoading={ocrSaving}
      >
        <Spin spinning={ocrSaving}>
          <Table
            columns={ocrColumns}
            dataSource={ocrData}
            rowKey={(_, idx) => idx}
            pagination={false}
            scroll={{ x: 1000 }}
            size="small"
          />
        </Spin>
      </Modal>
    </div>
  )
}
