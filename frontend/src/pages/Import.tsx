import { Card, Upload, Select, message, Tabs, Alert, Space } from 'antd'
import { InboxOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { uploadCSV, uploadImage } from '@/api/bills'

const { Dragger } = Upload

export default function Import() {
  const [csvLoading, setCsvLoading] = useState(false)
  const [imgLoading, setImgLoading] = useState(false)

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

  const items = [
    {
      key: 'csv',
      label: '导入 CSV 账单',
      children: (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Alert
            type="info"
            message="如何导出账单"
            description={
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                <li><strong>微信</strong>：微信 → 我 → 服务 → 钱包 → 账单 → 常见问题 → 下载账单（CSV 或 XLSX 格式）</li>
                <li><strong>支付宝</strong>：支付宝 → 我的 → 账单 → 右上角下载 → 选择时间范围导出</li>
              </ul>
            }
          />
          <Dragger
            accept=".csv,.xlsx,.xls"
            beforeUpload={handleCsvUpload}
            showUploadList={false}
          >
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p className="ant-upload-text">点击或拖拽账单文件到此区域</p>
            <p className="ant-upload-hint">支持微信账单（CSV / XLSX）/ 支付宝账单（CSV）</p>
          </Dragger>
          {csvLoading && <div style={{ textAlign: 'center', color: '#666' }}>正在导入中...</div>}
        </Space>
      ),
    },
    {
      key: 'image',
      label: '识别账单图片',
      children: (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Alert
            type="info"
            message="图片识别说明"
            description="支持上传账单截图（手机截图、扫描件），系统使用 Claude Vision AI 自动识别交易记录。需要配置有效的 ANTHROPIC_API_KEY。"
          />
          <Dragger
            accept="image/*"
            beforeUpload={handleImageUpload}
            showUploadList={false}
          >
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p className="ant-upload-text">点击或拖拽图片到此区域</p>
            <p className="ant-upload-hint">支持 JPG / PNG / WebP 格式</p>
          </Dragger>
          {imgLoading && <div style={{ textAlign: 'center', color: '#666' }}>AI 识别中，请稍候...</div>}
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Card title="导入账单数据">
        <Tabs items={items} />
      </Card>
    </div>
  )
}
