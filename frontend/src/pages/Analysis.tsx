import { Card, Button, Select, Alert } from 'antd'
import { RobotOutlined } from '@ant-design/icons'
import { useState, useRef } from 'react'

const { Option } = Select

export default function Analysis() {
  const [months, setMonths] = useState(3)
  const [loading, setLoading] = useState(false)
  const [content, setContent] = useState('')
  const abortRef = useRef<() => void>()

  const startAnalysis = () => {
    setContent('')
    setLoading(true)

    const url = `/api/analysis/stream?months=${months}`
    const eventSource = new EventSource(url)

    abortRef.current = () => eventSource.close()

    eventSource.onmessage = (e) => {
      if (e.data === '[DONE]') {
        eventSource.close()
        setLoading(false)
        return
      }
      setContent((prev) => prev + e.data)
    }

    eventSource.onerror = () => {
      eventSource.close()
      setLoading(false)
    }
  }

  const stopAnalysis = () => {
    abortRef.current?.()
    setLoading(false)
  }

  return (
    <div style={{ padding: 24 }}>
      <Card title="AI 消费分析">
        <Alert
          type="info"
          style={{ marginBottom: 16 }}
          message="AI 分析会根据你的消费数据生成个性化报告，包括消费结构分析、趋势对比和节省建议。需配置 ANTHROPIC_API_KEY。"
        />
        <div style={{ marginBottom: 16 }}>
          <span style={{ marginRight: 8 }}>分析近</span>
          <Select value={months} onChange={setMonths} style={{ width: 80 }}>
            <Option value={1}>1个月</Option>
            <Option value={3}>3个月</Option>
            <Option value={6}>6个月</Option>
            <Option value={12}>12个月</Option>
          </Select>
          <span style={{ marginLeft: 8, marginRight: 16 }}>的数据</span>
          {!loading
            ? <Button type="primary" icon={<RobotOutlined />} onClick={startAnalysis}>生成分析报告</Button>
            : <Button danger onClick={stopAnalysis}>停止生成</Button>
          }
        </div>

        {content && (
          <Card
            style={{ background: '#fafafa', border: '1px solid #f0f0f0' }}
            styles={{ body: { whiteSpace: 'pre-wrap', lineHeight: 1.8 } }}
          >
            {content}
            {loading && <span style={{ display: 'inline-block', animation: 'blink 1s step-end infinite' }}>▌</span>}
          </Card>
        )}
        {!content && !loading && (
          <div style={{ textAlign: 'center', padding: 48, color: '#999' }}>
            点击"生成分析报告"开始 AI 分析
          </div>
        )}
      </Card>
    </div>
  )
}
