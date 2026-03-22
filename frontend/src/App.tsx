import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import 'dayjs/locale/zh-cn'
import dayjs from 'dayjs'
import MainLayout from '@/layouts/MainLayout'
import Dashboard from '@/pages/Dashboard'
import Bills from '@/pages/Bills'
import Stats from '@/pages/Stats'
import Analysis from '@/pages/Analysis'
import Import from '@/pages/Import'

dayjs.locale('zh-cn')

export default function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="bills" element={<Bills />} />
            <Route path="stats" element={<Stats />} />
            <Route path="analysis" element={<Analysis />} />
            <Route path="import" element={<Import />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  )
}
