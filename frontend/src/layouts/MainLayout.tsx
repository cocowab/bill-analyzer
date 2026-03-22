import { Layout, Menu } from 'antd'
import {
  DashboardOutlined,
  UnorderedListOutlined,
  BarChartOutlined,
  RobotOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'

const { Header, Sider, Content } = Layout

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '概览' },
  { key: '/bills', icon: <UnorderedListOutlined />, label: '账单明细' },
  { key: '/import', icon: <UploadOutlined />, label: '导入账单' },
  { key: '/stats', icon: <BarChartOutlined />, label: '统计分析' },
  { key: '/analysis', icon: <RobotOutlined />, label: 'AI 消费建议' },
]

export default function MainLayout() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={200} theme="dark">
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 18,
            fontWeight: 600,
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          账单分析
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ marginTop: 8 }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 500, color: '#333' }}>
            {menuItems.find((i) => i.key === location.pathname)?.label ?? '账单分析系统'}
          </span>
        </Header>
        <Content style={{ margin: 24, background: '#f5f5f5', borderRadius: 8 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
