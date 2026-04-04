import { Card, Form, Input, AutoComplete, Radio, Button, message, Spin, Typography } from 'antd'
import { useState, useEffect } from 'react'

const { Text } = Typography

const CARD_STYLE = { borderRadius: 12, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 20 }

const COMMON_AI_MODELS = [
  { label: 'qwen3-max', value: 'qwen3-max' },
  { label: 'qwen3-plus', value: 'qwen3-plus' },
  { label: 'qwen3-turbo', value: 'qwen3-turbo' },
  { label: 'gpt-4o', value: 'gpt-4o' },
  { label: 'gpt-4o-mini', value: 'gpt-4o-mini' },
  { label: 'deepseek-chat', value: 'deepseek-chat' },
  { label: 'glm-4', value: 'glm-4' },
]

const COMMON_VISION_MODELS = [
  { label: 'qwen-vl-max', value: 'qwen-vl-max' },
  { label: 'qwen-vl-plus', value: 'qwen-vl-plus' },
  { label: 'gpt-4o', value: 'gpt-4o' },
  { label: 'gpt-4-vision-preview', value: 'gpt-4-vision-preview' },
  { label: 'glm-4v', value: 'glm-4v' },
]

export default function Settings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [ocrMode, setOcrMode] = useState<'local' | 'remote'>('local')
  const [ocrForm] = Form.useForm()
  const [aiForm] = Form.useForm()

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        setOcrMode(data.ocr_mode || 'local')
        ocrForm.setFieldsValue({
          ocr_mode: data.ocr_mode || 'local',
          ocr_local_model: data.ocr_local_model || 'qwen3-vl:4b',
          ocr_remote_base_url: data.ocr_remote_base_url || '',
          ocr_remote_api_key: data.ocr_remote_api_key || '',
          ocr_remote_model: data.ocr_remote_model || '',
        })
        aiForm.setFieldsValue({
          ai_base_url: data.ai_base_url || '',
          ai_api_key: data.ai_api_key || '',
          ai_model: data.ai_model || 'qwen3-max',
        })
      })
      .catch(() => message.error('加载配置失败'))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    try {
      await ocrForm.validateFields()
      await aiForm.validateFields()
    } catch {
      return
    }
    setSaving(true)
    try {
      const ocrValues = ocrForm.getFieldsValue()
      const aiValues = aiForm.getFieldsValue()
      const payload = { ...ocrValues, ...aiValues }
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        message.success('设置已保存')
      } else {
        const err = await res.json()
        message.error(err.detail || '保存失败')
      }
    } catch {
      message.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
  }

  return (
    <div style={{ maxWidth: 720 }}>
      {/* OCR 设置 */}
      <Card style={CARD_STYLE} title={<span style={{ fontWeight: 600 }}>OCR 识别配置</span>}>
        <Form form={ocrForm} layout="vertical">
          <Form.Item label="识别模式" name="ocr_mode">
            <Radio.Group onChange={(e) => setOcrMode(e.target.value)}>
              <Radio value="local">本地模型（Ollama）</Radio>
              <Radio value="remote">远程模型</Radio>
            </Radio.Group>
          </Form.Item>

          {ocrMode === 'local' && (
            <Form.Item label="本地模型名" name="ocr_local_model" extra="Ollama 中已安装的视觉模型名称">
              <Input placeholder="qwen3-vl:4b" />
            </Form.Item>
          )}

          {ocrMode === 'remote' && (
            <>
              <Form.Item
                label="API 地址"
                name="ocr_remote_base_url"
                rules={[{ required: true, message: '请输入 API 地址' }]}
              >
                <Input placeholder="请输入 OpenAI 兼容接口地址" />
              </Form.Item>
              <Form.Item label="API Key" name="ocr_remote_api_key">
                <Input.Password placeholder="请输入 API Key" />
              </Form.Item>
              <Form.Item
                label="模型"
                name="ocr_remote_model"
                rules={[{ required: true, message: '请选择或输入模型名' }]}
              >
                <AutoComplete
                  options={COMMON_VISION_MODELS}
                  placeholder="选择或输入模型名"
                  filterOption={(input, option) =>
                    (option?.value as string)?.toLowerCase().includes(input.toLowerCase())
                  }
                />
              </Form.Item>
            </>
          )}
        </Form>
      </Card>

      {/* AI 分析设置 */}
      <Card style={CARD_STYLE} title={<span style={{ fontWeight: 600 }}>AI 消费建议配置</span>}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 13 }}>
          使用 OpenAI 兼容接口，需要模型支持 Function Calling（工具调用）
        </Text>
        <Form form={aiForm} layout="vertical">
          <Form.Item
            label="API 地址"
            name="ai_base_url"
            rules={[{ required: true, message: '请输入 API 地址' }]}
          >
            <Input placeholder="请输入 OpenAI 兼容接口地址" />
          </Form.Item>
          <Form.Item label="API Key" name="ai_api_key">
            <Input.Password placeholder="请输入 API Key" />
          </Form.Item>
          <Form.Item
            label="模型"
            name="ai_model"
            rules={[{ required: true, message: '请选择或输入模型名' }]}
          >
            <AutoComplete
              options={COMMON_AI_MODELS}
              placeholder="选择或输入模型名"
              filterOption={(input, option) =>
                (option?.value as string)?.toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
        </Form>
      </Card>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button type="primary" size="large" loading={saving} onClick={handleSave}>
          保存设置
        </Button>
      </div>
    </div>
  )
}
