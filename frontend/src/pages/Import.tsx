import { Card, Upload, message, Tabs, Alert, Space, Typography, theme, Button, Collapse } from 'antd'
import { InboxOutlined, LoadingOutlined, QuestionCircleOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { uploadCSV, uploadImage } from '@/api/bills'

const { Dragger } = Upload
const { Text } = Typography

const CARD_STYLE = { borderRadius: 12, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }

export default function Import() {
  const [csvLoading, setCsvLoading] = useState(false)
  const [imgLoading, setImgLoading] = useState(false)
  const [showCsvGuide, setShowCsvGuide] = useState(false)
  const { token } = theme.useToken()

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
    setImgLoading(true)
    try {
      const res: any = await uploadImage(file)
      message.success(`识别完成：共识别 ${res.recognized} 条，保存 ${res.saved} 条`)
    } catch {
      message.error('识别失败，请确认已配置 ANTHROPIC_API_KEY')
    } finally {
      setImgLoading(false)
    }
    return false
  }

  const draggerStyle = {
    borderRadius: 10,
    background: token.colorFillAlter,
  }

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
            disabled={imgLoading}
            style={draggerStyle}
          >
            <p className="ant-upload-drag-icon" style={{ marginBottom: 8 }}>
              {imgLoading ? <LoadingOutlined style={{ fontSize: 40, color: token.colorPrimary }} /> : <InboxOutlined style={{ fontSize: 40 }} />}
            </p>
            <p className="ant-upload-text" style={{ fontSize: 15, fontWeight: 500 }}>
              {imgLoading ? 'AI 识别中，请稍候...' : '点击或拖拽图片到此区域'}
            </p>
            <p className="ant-upload-hint" style={{ color: '#999' }}>
              支持 JPG / PNG / WebP 格式
            </p>
          </Dragger>
          {imgLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
              <LoadingOutlined style={{ color: token.colorPrimary }} />
              <Text type="secondary">AI 识别中，可能需要约 10-30 秒...</Text>
            </div>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Card style={CARD_STYLE} title={<span style={{ fontWeight: 600 }}>导入账单数据</span>}>
        <Tabs items={items} size="large" />
      </Card>
    </div>
  )
}
