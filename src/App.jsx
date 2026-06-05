import { BrowserRouter, Routes, Route } from 'react-router-dom'
import PoolBoiHome from './pages/pool-boi-home'
import PoolBoiTest from './pages/pool-boi-test'
import PoolBoiInventory from './pages/pool-boi-inventory'
import PoolBoiHistory from './pages/pool-boi-history'
import PoolBoiSettings from './pages/pool-boi-settings'
import PoolBoiNav from './components/pool-boi-nav'
import './index.css'

export default function App() {
  return (
    <BrowserRouter>
      <div className="pb-content">
        <Routes>
          <Route path="/" element={<PoolBoiHome />} />
          <Route path="/test" element={<PoolBoiTest />} />
          <Route path="/inventory" element={<PoolBoiInventory />} />
          <Route path="/history" element={<PoolBoiHistory />} />
          <Route path="/settings" element={<PoolBoiSettings />} />
        </Routes>
      </div>
      <PoolBoiNav />
    </BrowserRouter>
  )
}
