/**
 * 外观配置全局状态，从 settingsCache 读取后存这里，
 * 组件直接 import 使用，无需 Context/Redux。
 */

export interface AppearanceConfig {
  themeColor: string
  themeMode: 'light' | 'dark'
  userAvatar: string
  aiAvatar: string
}

const DEFAULT: AppearanceConfig = {
  themeColor: '#1677ff',
  themeMode: 'light',
  userAvatar: 'default',
  aiAvatar: 'default',
}

let _config: AppearanceConfig = { ...DEFAULT }
const _listeners: Array<(c: AppearanceConfig) => void> = []

export function getAppearance(): AppearanceConfig {
  return _config
}

export function setAppearance(patch: Partial<AppearanceConfig>) {
  _config = { ..._config, ...patch }
  _listeners.forEach((fn) => fn(_config))
}

export function subscribeAppearance(fn: (c: AppearanceConfig) => void): () => void {
  _listeners.push(fn)
  return () => {
    const idx = _listeners.indexOf(fn)
    if (idx >= 0) _listeners.splice(idx, 1)
  }
}

export function applyFromSettings(data: Record<string, string>) {
  setAppearance({
    themeColor: data.theme_color || DEFAULT.themeColor,
    themeMode: (data.theme_mode as 'light' | 'dark') || DEFAULT.themeMode,
    userAvatar: data.user_avatar || DEFAULT.userAvatar,
    aiAvatar: data.ai_avatar || DEFAULT.aiAvatar,
  })
}

export const THEME_PRESETS = [
  { label: '默认蓝', value: '#1677ff' },
  { label: '极客绿', value: '#52c41a' },
  { label: '活力橙', value: '#fa8c16' },
  { label: '玫瑰红', value: '#f5222d' },
  { label: '深紫', value: '#722ed1' },
  { label: '青色', value: '#13c2c2' },
]

export const USER_AVATARS = [
  { label: '默认', value: 'default', icon: 'UserOutlined', bg: '#e6f4ff', color: '#1677ff' },
  { label: '极客', value: 'code', icon: 'CodeOutlined', bg: '#f6ffed', color: '#52c41a' },
  { label: '财务', value: 'audit', icon: 'AuditOutlined', bg: '#fff7e6', color: '#fa8c16' },
  { label: '星星', value: 'star', icon: 'StarOutlined', bg: '#fff0f6', color: '#eb2f96' },
  { label: '皇冠', value: 'crown', icon: 'CrownOutlined', bg: '#feffe6', color: '#fadb14' },
]

export const AI_AVATARS = [
  { label: '机器人', value: 'default', icon: 'RobotOutlined', bg: 'linear-gradient(135deg,#1677ff,#4096ff)', color: '#fff' },
  { label: '闪电', value: 'thunder', icon: 'ThunderboltOutlined', bg: 'linear-gradient(135deg,#fa8c16,#ffd666)', color: '#fff' },
  { label: '火箭', value: 'rocket', icon: 'RocketOutlined', bg: 'linear-gradient(135deg,#722ed1,#b37feb)', color: '#fff' },
  { label: '星球', value: 'experiment', icon: 'ExperimentOutlined', bg: 'linear-gradient(135deg,#13c2c2,#87e8de)', color: '#fff' },
  { label: '心形', value: 'heart', icon: 'HeartOutlined', bg: 'linear-gradient(135deg,#f5222d,#ff7875)', color: '#fff' },
]
