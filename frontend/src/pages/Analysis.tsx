import { Card, Input, Button, Space, Typography } from 'antd'
import {
  RobotOutlined,
  SendOutlined,
  UserOutlined,
  DeleteOutlined,
  CheckCircleFilled,
  LoadingOutlined,
} from '@ant-design/icons'
import { useState, useRef, useEffect, useCallback } from 'react'

const { Text } = Typography

interface ToolStep {
  name: string
  desc: string
  status: 'loading' | 'done'
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'steps'
  content: string
  steps?: ToolStep[]
}

const TOOL_NAME_MAP: Record<string, string> = {
  get_metadata: '获取账单结构',
  analyze_bills: '统计分析',
  query_bills: '查询明细',
  compare_periods: '对比分析',
  query_actions: '查询操作记录',
}

function toolDesc(name: string, args: Record<string, unknown>): string {
  if (name === 'get_metadata') return '读取分类、数据范围等元信息'
  if (name === 'analyze_bills') {
    const parts: string[] = []
    if (args.flow_type === 'expense') parts.push('支出')
    else if (args.flow_type === 'income') parts.push('收入')
    if (args.category) parts.push(`分类「${args.category}」`)
    if (args.start_date) parts.push(`${args.start_date} ~ ${args.end_date || '至今'}`)
    const dimMap: Record<string, string> = { day: '日', month: '月', payment_method: '支付方式', category: '分类', source: '来源' }
    if (args.source) parts.push(`来源「${args.source}」`)
    parts.push(`按${dimMap[args.group_by as string] || args.group_by}聚合`)
    return parts.join('，')
  }
  if (name === 'query_bills') {
    const parts = ['查询明细']
    if (args.keyword) parts.push(`关键词「${args.keyword}」`)
    if (args.merchant) parts.push(`商户「${args.merchant}」`)
    if (args.source) parts.push(`来源「${args.source}」`)
    if (args.order_by === 'amount') parts.push('按金额排序')
    if (args.limit) parts.push(`前${args.limit}条`)
    return parts.join('，')
  }
  if (name === 'compare_periods') {
    return `对比 ${args.period_a_start}~${args.period_a_end} 与 ${args.period_b_start}~${args.period_b_end}`
  }
  if (name === 'query_actions') {
    const parts = ['操作记录']
    const typeMap: Record<string, string> = { create_bill: '手动录入', update_bill: '修改账单', delete_bill: '删除账单', import_csv: '导入CSV', import_ocr: 'OCR导入' }
    if (args.action_type) parts.push(typeMap[args.action_type as string] || String(args.action_type))
    if (args.start_date) parts.push(`${args.start_date} ~ ${args.end_date || '至今'}`)
    return parts.join('，')
  }
  return JSON.stringify(args)
}

const QUICK_QUESTIONS = [
  '帮我分析一下最近的消费情况',
  '这个月花了多少钱？',
  '花钱最多的一笔是什么？',
  '消费分类排行',
]

let cachedMessages: ChatMessage[] = []

function renderMarkdown(text: string) {
  text = text.replace(/^```markdown\s*/i, '').replace(/```\s*$/, '')
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '')
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let key = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith('### ')) {
      elements.push(<h3 key={key++} style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1a', margin: '16px 0 6px' }}>{line.slice(4)}</h3>)
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={key++} style={{ fontSize: 16, fontWeight: 700, color: '#1677ff', margin: '20px 0 8px', borderLeft: '3px solid #1677ff', paddingLeft: 10 }}>{line.slice(3)}</h2>)
    } else if (line.startsWith('# ')) {
      elements.push(<h1 key={key++} style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a', margin: '0 0 12px' }}>{line.slice(2)}</h1>)
    } else if (line.match(/^\d+\. /)) {
      elements.push(<div key={key++} style={{ padding: '3px 0 3px 16px', color: '#333' }}>{line}</div>)
    } else if (line.startsWith('- ') || line.startsWith('• ')) {
      const content = line.slice(2)
      const parts = content.split(/(\*\*[^*]+\*\*)/g)
      elements.push(
        <div key={key++} style={{ padding: '2px 0 2px 16px', color: '#333' }}>
          {'• '}
          {parts.map((p, j) =>
            p.startsWith('**') && p.endsWith('**')
              ? <strong key={j} style={{ color: '#1a1a1a' }}>{p.slice(2, -2)}</strong>
              : p
          )}
        </div>
      )
    } else if (line.trim() === '') {
      elements.push(<div key={key++} style={{ height: 4 }} />)
    } else {
      const parts = line.split(/(\*\*[^*]+\*\*)/g)
      elements.push(
        <div key={key++} style={{ padding: '2px 0', color: '#444', lineHeight: 1.8 }}>
          {parts.map((p, j) =>
            p.startsWith('**') && p.endsWith('**')
              ? <strong key={j} style={{ color: '#1a1a1a' }}>{p.slice(2, -2)}</strong>
              : p
          )}
        </div>
      )
    }
  }
  return elements
}

// 步骤列表渲染组件
function StepsBlock({ steps, thinking, isLive }: { steps: ToolStep[]; thinking?: boolean; isLive?: boolean }) {
  // 判断是否所有步骤已完成
  const allDone = steps.every((s) => s.status === 'done')
  // 是否正在等待（有工具还在 loading）
  const hasLoading = steps.some((s) => s.status === 'loading')

  return (
    <div style={{ display: 'flex', marginBottom: 12 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 16,
        background: 'linear-gradient(135deg, #1677ff, #4096ff)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginRight: 10, flexShrink: 0,
      }}>
        <RobotOutlined style={{ color: '#fff', fontSize: 16 }} />
      </div>
      <div style={{
        padding: '12px 16px',
        borderRadius: '12px',
        background: '#f6f8fa',
        border: '1px solid #e8ecf0',
        minWidth: 260,
      }}>
        {steps.map((step, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '6px 0',
            borderBottom: (i < steps.length - 1 || (isLive && (thinking || hasLoading))) ? '1px solid #eee' : 'none',
          }}>
            {step.status === 'done'
              ? <CheckCircleFilled style={{ color: '#52c41a', fontSize: 15, flexShrink: 0 }} />
              : <LoadingOutlined style={{ color: '#1677ff', fontSize: 15, flexShrink: 0 }} />
            }
            <span style={{ fontWeight: 500, color: '#1677ff', whiteSpace: 'nowrap' }}>
              {TOOL_NAME_MAP[step.name] || step.name}
            </span>
            <span style={{ color: '#888', fontSize: 13 }}>{step.desc}</span>
          </div>
        ))}
        {isLive && thinking && allDone && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
            <LoadingOutlined style={{ color: '#1677ff', fontSize: 15, flexShrink: 0 }} />
            <span style={{ color: '#999', fontSize: 13 }}>正在生成回复...</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Analysis() {
  const [messages, setMessages] = useState<ChatMessage[]>(cachedMessages)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [liveSteps, setLiveSteps] = useState<ToolStep[]>([])
  const [thinking, setThinking] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const messagesRef = useRef<ChatMessage[]>(cachedMessages)

  const updateMessages = useCallback((msgs: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    setMessages((prev) => {
      const next = typeof msgs === 'function' ? msgs(prev) : msgs
      messagesRef.current = next
      cachedMessages = next
      return next
    })
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, liveSteps, thinking])

  const sendMessage = async (text?: string) => {
    const content = text || input.trim()
    if (!content || loading) return

    const userMsg: ChatMessage = { role: 'user', content }
    const prev = messagesRef.current
    const newMessages = [...prev, userMsg]
    updateMessages(newMessages)
    setInput('')
    setLoading(true)
    setLiveSteps([])
    setThinking(false)

    const history = prev
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: m.content }))

    try {
      const controller = new AbortController()
      abortRef.current = controller

      const resp = await fetch('/api/analysis/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, history }),
        signal: controller.signal,
      })

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)

      const reader = resp.body?.getReader()
      if (!reader) throw new Error('No reader')

      const decoder = new TextDecoder()
      let assistantContent = ''
      const steps: ToolStep[] = []
      let buffer = ''
      let stepsFinalized = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))

            if (data.type === 'tool_call') {
              // 工具到达时关闭上一轮的 thinking
              setThinking(false)
              const step: ToolStep = {
                name: data.name,
                desc: toolDesc(data.name, data.arguments),
                status: 'loading',
              }
              steps.push(step)
              setLiveSteps([...steps])
            } else if (data.type === 'tool_result') {
              // 标记对应工具为完成
              const idx = [...steps].reverse().findIndex((s) => s.name === data.name && s.status === 'loading')
              if (idx >= 0) {
                steps[steps.length - 1 - idx].status = 'done'
                setLiveSteps([...steps])
              }
            } else if (data.type === 'thinking') {
              // 所有工具完成后，等待 LLM 下一步决策
              setThinking(true)
            } else if (data.type === 'content') {
              // 首次收到内容，把步骤固化到消息列表
              if (!stepsFinalized && steps.length > 0) {
                stepsFinalized = true
                const stepsMsg: ChatMessage = { role: 'steps', content: '', steps: [...steps] }
                newMessages.push(stepsMsg)
                setLiveSteps([])
                setThinking(false)
              }
              assistantContent += data.text
              const allMsgs = [...newMessages]
              const lastMsg = allMsgs[allMsgs.length - 1]
              if (lastMsg?.role === 'assistant') {
                allMsgs[allMsgs.length - 1] = { role: 'assistant', content: assistantContent }
              } else {
                allMsgs.push({ role: 'assistant', content: assistantContent })
              }
              updateMessages(allMsgs)
            } else if (data.type === 'full_content') {
              // 后端一次性返回完整文本，前端逐字模拟打字机效果
              if (!stepsFinalized && steps.length > 0) {
                stepsFinalized = true
                const stepsMsg: ChatMessage = { role: 'steps', content: '', steps: [...steps] }
                newMessages.push(stepsMsg)
                setLiveSteps([])
                setThinking(false)
              }
              const fullText: string = data.text || ''
              let charIdx = 0
              const baseMessages = [...newMessages]
              const timer = setInterval(() => {
                charIdx++
                const partial = fullText.slice(0, charIdx)
                const msgs = [...baseMessages]
                if (msgs[msgs.length - 1]?.role === 'assistant') {
                  msgs[msgs.length - 1] = { role: 'assistant', content: partial }
                } else {
                  msgs.push({ role: 'assistant', content: partial })
                }
                updateMessages(msgs)
                if (charIdx >= fullText.length) clearInterval(timer)
              }, 16)
            }
          } catch {
            // 忽略
          }
        }
      }

      // 如果没有内容但有步骤
      if (!assistantContent && steps.length > 0 && !stepsFinalized) {
        const allMsgs = [...newMessages, { role: 'steps' as const, content: '', steps: [...steps] }]
        allMsgs.push({ role: 'assistant' as const, content: '分析完成。' })
        updateMessages(allMsgs)
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        updateMessages([
          ...messagesRef.current,
          { role: 'assistant', content: `请求失败：${err.message}` },
        ])
      }
    } finally {
      setLoading(false)
      setLiveSteps([])
      setThinking(false)
      abortRef.current = null
    }
  }

  const stopGeneration = () => {
    abortRef.current?.abort()
    setLoading(false)
  }

  const clearHistory = () => {
    updateMessages([])
    setLiveSteps([])
    setThinking(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      <Card
        style={{
          flex: 1, borderRadius: 12,
          boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
        styles={{
          body: { flex: 1, overflow: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column' },
        }}
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <RobotOutlined style={{ color: '#1677ff' }} />
              <span style={{ fontWeight: 600 }}>AI 账单助手</span>
            </Space>
            {messages.length > 0 && (
              <Button size="small" icon={<DeleteOutlined />} onClick={clearHistory} disabled={loading}>
                清空对话
              </Button>
            )}
          </div>
        }
      >
        {/* 空状态 */}
        {messages.length === 0 && !loading && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <RobotOutlined style={{ fontSize: 56, color: '#ddd', marginBottom: 16 }} />
            <div style={{ fontSize: 16, color: '#999', marginBottom: 24 }}>你好，我是你的 AI 账单助手，有什么可以帮你分析的？</div>
            <Space wrap style={{ maxWidth: 500, justifyContent: 'center' }}>
              {QUICK_QUESTIONS.map((q) => (
                <Button key={q} size="small" style={{ borderRadius: 16, color: '#1677ff', borderColor: '#1677ff' }} onClick={() => sendMessage(q)}>
                  {q}
                </Button>
              ))}
            </Space>
          </div>
        )}

        {/* 已有消息 */}
        {messages.map((msg, idx) => {
          if (msg.role === 'steps') {
            return <StepsBlock key={idx} steps={msg.steps || []} isLive={false} />
          }
          if (msg.role === 'user') {
            return (
              <div key={idx} style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                <div style={{
                  maxWidth: '80%', padding: '10px 16px',
                  borderRadius: '16px 16px 4px 16px',
                  background: 'linear-gradient(135deg, #1677ff, #4096ff)',
                  color: '#fff', fontSize: 14, lineHeight: 1.6,
                }}>
                  {msg.content}
                </div>
                <div style={{
                  width: 32, height: 32, borderRadius: 16, background: '#e6f4ff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginLeft: 10, flexShrink: 0,
                }}>
                  <UserOutlined style={{ color: '#1677ff', fontSize: 16 }} />
                </div>
              </div>
            )
          }
          // assistant
          return (
            <div key={idx} style={{ display: 'flex', marginBottom: 16 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 16,
                background: 'linear-gradient(135deg, #1677ff, #4096ff)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginRight: 10, flexShrink: 0,
              }}>
                <RobotOutlined style={{ color: '#fff', fontSize: 16 }} />
              </div>
              <div style={{
                maxWidth: '80%', padding: '12px 16px',
                borderRadius: '16px 16px 16px 4px',
                background: '#f5f5f5', color: '#333', fontSize: 14, lineHeight: 1.6,
              }}>
                {renderMarkdown(msg.content)}
                {loading && idx === messages.length - 1 && (
                  <span style={{
                    display: 'inline-block', width: 2, height: '1em',
                    background: '#1677ff', marginLeft: 2, verticalAlign: 'text-bottom',
                    animation: 'blink 1s step-end infinite',
                  }} />
                )}
              </div>
            </div>
          )
        })}

        {/* 实时步骤（还未固化到消息中） */}
        {liveSteps.length > 0 && (
          <StepsBlock steps={liveSteps} thinking={thinking} isLive />
        )}

        {/* 初始等待（没有任何步骤时） */}
        {loading && liveSteps.length === 0 && (messages.length === 0 || messages[messages.length - 1]?.role === 'user') && (
          <div style={{ display: 'flex', marginBottom: 16 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 16,
              background: 'linear-gradient(135deg, #1677ff, #4096ff)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginRight: 10, flexShrink: 0,
            }}>
              <RobotOutlined style={{ color: '#fff', fontSize: 16 }} />
            </div>
            <div style={{
              padding: '12px 20px', borderRadius: '16px 16px 16px 4px',
              background: '#f5f5f5', color: '#999',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <LoadingOutlined style={{ color: '#1677ff', fontSize: 16 }} />
              <span>思考中...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </Card>

      {/* 输入区域 */}
      <div style={{ marginTop: 12 }}>
        <Space.Compact style={{ width: '100%' }}>
          <Input
            size="large" value={input}
            onChange={(e) => setInput(e.target.value)}
            onPressEnter={() => sendMessage()}
            placeholder="问我关于账单的任何问题..."
            disabled={loading}
            style={{ borderRadius: '8px 0 0 8px' }}
          />
          {loading ? (
            <Button size="large" danger onClick={stopGeneration} style={{ borderRadius: '0 8px 8px 0' }}>停止</Button>
          ) : (
            <Button size="large" type="primary" icon={<SendOutlined />} onClick={() => sendMessage()} disabled={!input.trim()} style={{ borderRadius: '0 8px 8px 0' }}>发送</Button>
          )}
        </Space.Compact>
        <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
          AI 基于你的账单数据进行分析，按 Enter 发送
        </Text>
      </div>

      <style>{`
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      `}</style>
    </div>
  )
}
