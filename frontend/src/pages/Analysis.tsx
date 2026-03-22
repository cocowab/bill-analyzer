import { Card, Button, Select, Alert, Space, Typography, Divider } from 'antd'
import { RobotOutlined, StopOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useState, useRef } from 'react'
import ReactMarkdown from 'react-markdown'

const { Option } = Select
const { Text } = Typography

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
    <div>
      <Card
        style={{ borderRadius: 12, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
        title={
          <Space>
            <RobotOutlined style={{ color: '#722ed1' }} />
            <span style={{ fontWeight: 600 }}>AI 消费分析报告</span>
          </Space>
        }
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 20 }}
          message="AI 分析会根据你的消费数据生成个性化报告，包括消费结构分析、趋势对比和节省建议。需配置 ANTHROPIC_API_KEY。"
        />

        <Space size={12} align="center" style={{ marginBottom: 20 }}>
          <Text>分析近</Text>
          <Select value={months} onChange={setMonths} style={{ width: 90 }} disabled={loading}>
            <Option value={1}>1 个月</Option>
            <Option value={3}>3 个月</Option>
            <Option value={6}>6 个月</Option>
            <Option value={12}>12 个月</Option>
          </Select>
          <Text>的账单数据</Text>
          {!loading ? (
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              onClick={startAnalysis}
              style={{ background: 'linear-gradient(135deg, #722ed1, #4096ff)', border: 'none' }}
            >
              生成分析报告
            </Button>
          ) : (
            <Button danger icon={<StopOutlined />} onClick={stopAnalysis}>
              停止生成
            </Button>
          )}
        </Space>

        {content && (
          <>
            <Divider style={{ margin: '0 0 16px' }} />
            <div
              style={{
                background: '#fafafa',
                borderRadius: 8,
                padding: '20px 24px',
                border: '1px solid #f0f0f0',
                lineHeight: 1.9,
                fontSize: 14,
              }}
            >
              <div style={{ whiteSpace: 'pre-wrap' }}>
                {content}
                {loading && (
                  <span
                    style={{
                      display: 'inline-block',
                      width: 2,
                      height: '1em',
                      background: '#722ed1',
                      marginLeft: 2,
                      verticalAlign: 'text-bottom',
                      animation: 'blink 1s step-end infinite',
                    }}
                  />
                )}
              </div>
            </div>
          </>
        )}

        {!content && !loading && (
          <div
            style={{
              textAlign: 'center',
              padding: '60px 0',
              color: '#bbb',
            }}
          >
            <RobotOutlined style={{ fontSize: 48, marginBottom: 12, color: '#ddd' }} />
            <div style={{ fontSize: 14 }}>点击"生成分析报告"开始 AI 分析</div>
          </div>
        )}
      </Card>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
