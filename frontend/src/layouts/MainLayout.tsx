import { Layout, Menu, Button, theme } from 'antd'
import {
  UnorderedListOutlined,
  BarChartOutlined,
  RobotOutlined,
  UploadOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  AccountBookOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useState } from 'react'

const { Header, Sider, Content } = Layout

const menuItems = [
  { key: '/bills', icon: <UnorderedListOutlined />, label: '账单明细' },
  { key: '/import', icon: <UploadOutlined />, label: '导入账单' },
  { key: '/stats', icon: <BarChartOutlined />, label: '统计分析' },
  { key: '/analysis', icon: <RobotOutlined />, label: 'AI 消费建议' },
]

export default function MainLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const { token } = theme.useToken()

  const currentLabel = menuItems.find((i) => i.key === location.pathname)?.label ?? '账单分析'

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        width={220}
        collapsedWidth={64}
        collapsed={collapsed}
        theme="dark"
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          background: 'linear-gradient(180deg, #1a1f3a 0%, #141929 100%)',
          boxShadow: '2px 0 12px rgba(0,0,0,0.15)',
          transition: 'width 0.2s',
          zIndex: 100,
        }}
      >
        {/* Logo区域 */}
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? 0 : '0 20px',
            gap: 10,
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            overflow: 'hidden',
            transition: 'all 0.2s',
          }}
        >
          <AccountBookOutlined style={{ fontSize: 22, color: '#4096ff', flexShrink: 0 }} />
          {!collapsed && (
            <span style={{ color: '#fff', fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap', letterSpacing: 1 }}>
              账单分析
            </span>
          )}
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{
            marginTop: 8,
            background: 'transparent',
            borderRight: 'none',
          }}
        />
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 64 : 220, transition: 'margin-left 0.2s' }}>
        <Header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 99,
            background: '#fff',
            padding: '0 24px',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: 16, color: '#555' }}
          />
          <span style={{ fontSize: 15, fontWeight: 600, color: token.colorTextHeading }}>
            {currentLabel}
          </span>
        </Header>

        <Content
          style={{
            margin: 24,
            minHeight: 'calc(100vh - 112px)',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
