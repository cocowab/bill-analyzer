import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import 'dayjs/locale/zh-cn'
import dayjs from 'dayjs'
import { Navigate } from 'react-router-dom'
import MainLayout from '@/layouts/MainLayout'
import Bills from '@/pages/Bills'
import Stats from '@/pages/Stats'
import Analysis from '@/pages/Analysis'
import Import from '@/pages/Import'
import Settings from '@/pages/Settings'

dayjs.locale('zh-cn')

export default function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Navigate to="/bills" replace />} />
            <Route path="bills" element={<Bills />} />
            <Route path="stats" element={<Stats />} />
            <Route path="analysis" element={<Analysis />} />
            <Route path="import" element={<Import />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  )
}
