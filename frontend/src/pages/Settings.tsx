import { Card, Form, Input, AutoComplete, Radio, Button, message, Typography, Tooltip, ColorPicker } from 'antd'
import { useState, useEffect } from 'react'
import * as Icons from '@ant-design/icons'
import { EditOutlined } from '@ant-design/icons'
import { getSettings, updateCache } from '@/utils/settingsCache'
import {
  applyFromSettings, setAppearance,
  THEME_PRESETS, USER_AVATARS, AI_AVATARS,
} from '@/utils/appearanceStore'

const { Text } = Typography

const CARD_STYLE = { borderRadius: 12, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 20 }

const COMMON_AI_MODELS = [
  { label: 'qwen3-max', value: 'qwen3-max' },
  { label: 'qwen3-max-2026-01-23', value: 'qwen3-max-2026-01-23' },
  { label: 'qwen3-plus', value: 'qwen3-plus' },
  { label: 'qwen3-turbo', value: 'qwen3-turbo' },
]

const COMMON_VISION_MODELS = [
  { label: 'qwen-vl-max', value: 'qwen-vl-max' },
  { label: 'qwen-vl-plus', value: 'qwen-vl-plus' },
]

function applyToForms(data: Record<string, string>, ocrForm: any, aiForm: any, setOcrMode: (m: 'local' | 'remote') => void) {
  const mode = (data.ocr_mode as 'local' | 'remote') || 'local'
  setOcrMode(mode)
  ocrForm.setFieldsValue({
    ocr_mode: mode,
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
}

function AvatarOption({ item, selected, onClick }: { item: any; selected: boolean; onClick: () => void }) {
  const IconComp = (Icons as any)[item.icon]
  return (
    <Tooltip title={item.label}>
      <div
        onClick={onClick}
        style={{
          width: 44, height: 44, borderRadius: 22,
          background: item.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          border: selected ? '2px solid #1677ff' : '2px solid transparent',
          boxShadow: selected ? '0 0 0 2px #e6f4ff' : 'none',
          transition: 'all 0.2s',
        }}
      >
        <IconComp style={{ fontSize: 20, color: item.color }} />
      </div>
    </Tooltip>
  )
}

export default function Settings() {
  const [saving, setSaving] = useState(false)
  const [ocrMode, setOcrMode] = useState<'local' | 'remote'>('local')
  const [ocrForm] = Form.useForm()
  const [aiForm] = Form.useForm()

  // 外观状态
  const [themeColor, setThemeColor] = useState('#1677ff')
  const [userAvatar, setUserAvatar] = useState('default')
  const [aiAvatar, setAiAvatar] = useState('default')

  useEffect(() => {
    getSettings().then((data) => {
      applyToForms(data, ocrForm, aiForm, setOcrMode)
      setThemeColor(data.theme_color || '#1677ff')
      setUserAvatar(data.user_avatar || 'default')
      setAiAvatar(data.ai_avatar || 'default')
    })
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
      const appearanceValues = {
        theme_color: themeColor,
        user_avatar: userAvatar,
        ai_avatar: aiAvatar,
      }
      const payload = { ...ocrValues, ...aiValues, ...appearanceValues }
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        updateCache(payload)
        // 立即应用外观变化
        applyFromSettings(payload)
        setAppearance({ themeColor, userAvatar, aiAvatar })
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

  return (
    <div style={{ maxWidth: 720 }}>

      {/* 外观设置 */}
      <Card style={CARD_STYLE} title={<span style={{ fontWeight: 600 }}>外观设置</span>}>
        {/* 主题色 */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: '#666', marginBottom: 10 }}>主题颜色</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {THEME_PRESETS.map((p) => (
              <Tooltip key={p.value} title={p.label}>
                <div
                  onClick={() => setThemeColor(p.value)}
                  style={{
                    width: 28, height: 28, borderRadius: 14,
                    background: p.value, cursor: 'pointer',
                    border: themeColor === p.value ? '3px solid #fff' : '3px solid transparent',
                    boxShadow: themeColor === p.value ? `0 0 0 2px ${p.value}` : '0 1px 4px rgba(0,0,0,0.15)',
                    transition: 'all 0.2s',
                  }}
                />
              </Tooltip>
            ))}
            {/* 自定义颜色 */}
            {(() => {
              const isCustom = !THEME_PRESETS.some((p) => p.value === themeColor)
              return (
                <ColorPicker value={themeColor} onChange={(c) => setThemeColor(c.toHexString())} disabledAlpha>
                  <Tooltip title="自定义颜色">
                    <div style={{ position: 'relative', width: 28, height: 28, cursor: 'pointer' }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 14,
                        background: themeColor,
                        border: isCustom ? '3px solid #fff' : '3px solid transparent',
                        boxShadow: isCustom ? `0 0 0 2px ${themeColor}` : '0 1px 4px rgba(0,0,0,0.15)',
                        transition: 'all 0.2s',
                      }} />
                      <div style={{
                        position: 'absolute', bottom: -2, right: -2,
                        width: 12, height: 12, borderRadius: 6,
                        background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <EditOutlined style={{ fontSize: 7, color: '#555' }} />
                      </div>
                    </div>
                  </Tooltip>
                </ColorPicker>
              )
            })()}
          </div>
        </div>

        {/* 用户头像 */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: '#666', marginBottom: 10 }}>我的头像</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {USER_AVATARS.map((a) => (
              <AvatarOption key={a.value} item={a} selected={userAvatar === a.value} onClick={() => setUserAvatar(a.value)} />
            ))}
          </div>
        </div>

        {/* AI 头像 */}
        <div>
          <div style={{ fontSize: 13, color: '#666', marginBottom: 10 }}>AI 头像</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {AI_AVATARS.map((a) => (
              <AvatarOption key={a.value} item={a} selected={aiAvatar === a.value} onClick={() => setAiAvatar(a.value)} />
            ))}
          </div>
        </div>
      </Card>

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
              <Form.Item label="API 地址" name="ocr_remote_base_url" rules={[{ required: true, message: '请输入 API 地址' }]}>
                <Input placeholder="请输入 OpenAI 兼容接口地址" />
              </Form.Item>
              <Form.Item label="API Key" name="ocr_remote_api_key">
                <Input.Password placeholder="请输入 API Key" />
              </Form.Item>
              <Form.Item label="模型" name="ocr_remote_model" rules={[{ required: true, message: '请选择或输入模型名' }]}>
                <AutoComplete
                  options={COMMON_VISION_MODELS}
                  placeholder="选择或输入模型名"
                  filterOption={(input, option) => (option?.value as string)?.toLowerCase().includes(input.toLowerCase())}
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
          <Form.Item label="API 地址" name="ai_base_url" rules={[{ required: true, message: '请输入 API 地址' }]}>
            <Input placeholder="请输入 OpenAI 兼容接口地址" />
          </Form.Item>
          <Form.Item label="API Key" name="ai_api_key">
            <Input.Password placeholder="请输入 API Key" />
          </Form.Item>
          <Form.Item label="模型" name="ai_model" rules={[{ required: true, message: '请选择或输入模型名' }]}>
            <AutoComplete
              options={COMMON_AI_MODELS}
              placeholder="选择或输入模型名"
              filterOption={(input, option) => (option?.value as string)?.toLowerCase().includes(input.toLowerCase())}
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
