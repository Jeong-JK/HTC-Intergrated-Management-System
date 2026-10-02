import { Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, Calendar, Package, ChevronDown, ChevronRight,
  Truck, PackagePlus, ClipboardList, Menu, X, Settings as Settings2, Home, ListFilter
} from 'lucide-react'
import AlertBell from '../components/AlertBell.jsx'

import Dashboard      from '../pages/Dashboard.jsx'
import CalendarPage   from '../pages/CalendarPage.jsx'
import StockDetail    from '../pages/StockDetail.jsx'
import StockRadio     from '../pages/stock/StockRadio.jsx'
import StockAntenna   from '../pages/stock/StockAntenna.jsx'
import StockAccessory from '../pages/stock/StockAccessory.jsx'
import ProductSpecs   from '../pages/ProductSpecs.jsx'
import OutRental      from '../pages/out/OutRental.jsx'
import OutDelivery    from '../pages/out/OutDelivery.jsx'
import InboundPage    from '../pages/inbound/InboundPage.jsx'
import InboundSummary from '../pages/inbound/InboundSummary.jsx'
import InboundDetail  from '../pages/inbound/InboundDetail.jsx'
import RentalHistory  from '../pages/RentalHistory.jsx'
import Settings       from '../pages/Settings.jsx'
import DeliveryHistory from '../pages/DeliveryHistory.jsx'

const NAV = [
  { to: '/inventory',         icon: LayoutDashboard, label: '재고현황' },
  { to: '/inventory/stock-detail', icon: ListFilter, label: '재고상세' },
  { to: '/inventory/calendar', icon: Calendar,        label: '대여캘린더' },
  {
    label: '재고', icon: Package, children: [
      { to: '/inventory/stock/radio',     label: '라디오' },
      { to: '/inventory/stock/antenna',   label: '안테나' },
      { to: '/inventory/stock/accessory', label: '악세사리' },
      { to: '/inventory/stock/specs',     label: '상세정보' },
    ]
  },
  {
    label: '출고', icon: Truck, children: [
      { to: '/inventory/out/rental',   label: '대여' },
      { to: '/inventory/out/delivery', label: '납품' },
    ]
  },
  {
    label: '입고', icon: PackagePlus, children: [
      { to: '/inventory/inbound', end: true, label: '제품 입고' },
      { to: '/inventory/inbound/summary', label: '입고 요약' },
      { to: '/inventory/inbound/detail',  label: '입고 상세' },
    ]
  },
  { to: '/inventory/rental-history',   icon: ClipboardList, label: '대여이력' },
  { to: '/inventory/delivery-history', icon: ClipboardList, label: '납품이력' },
  { to: '/inventory/settings', icon: Settings2, label: '드롭다운 관리' },
]

function NavItem({ item, open: sidebarOpen }) {
  const location = useLocation()
  const [expanded, setExpanded] = useState(() =>
    item.children?.some(c => location.pathname.startsWith(c.to))
  )

  if (item.children) {
    const isActive = item.children.some(c => location.pathname.startsWith(c.to))
    return (
      <div>
        <button onClick={() => setExpanded(e => !e)}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
            ${isActive ? 'text-accent font-medium' : 'text-dim hover:text-text hover:bg-slate-50'}`}>
          <item.icon size={16} className="flex-shrink-0"/>
          {sidebarOpen && (
            <>
              <span className="flex-1 text-left">{item.label}</span>
              {expanded ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
            </>
          )}
        </button>
        {sidebarOpen && expanded && (
          <div className="ml-8 mt-0.5 flex flex-col gap-0.5">
            {item.children.map(c => (
              <NavLink key={c.to} to={c.to} end={c.to === '/inventory/inbound'}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-xs transition-colors
                  ${isActive ? 'text-accent bg-blue-50 font-medium' : 'text-dim hover:text-text hover:bg-slate-50'}`
                }>
                {c.label}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <NavLink to={item.to} end={item.to === '/inventory'}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
        ${isActive ? 'bg-blue-50 text-accent font-medium border border-blue-100' : 'text-dim hover:text-text hover:bg-slate-50'}`
      }>
      <item.icon size={16} className="flex-shrink-0"/>
      {sidebarOpen && <span>{item.label}</span>}
    </NavLink>
  )
}

function Sidebar({ open, setOpen }) {
  const navigate = useNavigate()

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/20 z-20 md:hidden" onClick={() => setOpen(false)}/>}
      <aside onClick={!open ? () => setOpen(true) : undefined}
        className={`fixed top-0 left-0 h-full z-30 flex flex-col bg-white border-r border-slate-200 shadow-sm transition-all duration-300 ${open ? 'w-56' : 'w-14 cursor-pointer'} md:relative`}>
        <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-xs">H</span>
          </div>
          {open && (
            <div>
              <p className="text-text font-semibold text-sm">재고관리</p>
              <p className="text-dim text-xs">Inventory</p>
            </div>
          )}
        </div>

        <div className="px-2 pt-3">
          <button onClick={() => navigate('/')}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors border border-slate-200">
            <Home size={16} className="flex-shrink-0"/>
            {open && <span>메인으로</span>}
          </button>
        </div>

        <nav className="flex-1 py-4 flex flex-col gap-0.5 px-2 overflow-y-auto">
          {NAV.map((item, i) => <NavItem key={i} item={item} open={open}/>)}
        </nav>

        {open ? (
          <button onClick={() => setOpen(false)}
            className="m-3 flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors border border-slate-200 text-xs">
            <X size={14}/> 메뉴 닫기
          </button>
        ) : (
          <button onClick={() => setOpen(true)}
            className="m-3 p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors border border-slate-200">
            <Menu size={16}/>
          </button>
        )}
      </aside>
    </>
  )
}

export default function InventoryApp() {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    document.title = 'HTC 재고관리'
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen}/>
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-end">
          <AlertBell />
        </header>
        <main className="flex-1 overflow-auto bg-bg">
          <Routes>
            <Route path="/"                    element={<Dashboard/>}/>
            <Route path="/stock-detail"        element={<StockDetail/>}/>
            <Route path="/calendar"            element={<CalendarPage/>}/>
            <Route path="/stock/radio"         element={<StockRadio/>}/>
            <Route path="/stock/antenna"       element={<StockAntenna/>}/>
            <Route path="/stock/accessory"     element={<StockAccessory/>}/>
            <Route path="/stock/specs"         element={<ProductSpecs/>}/>
            <Route path="/out/rental"          element={<OutRental/>}/>
            <Route path="/out/delivery"        element={<OutDelivery/>}/>
            <Route path="/inbound"             element={<InboundPage/>}/>
            <Route path="/inbound/summary"     element={<InboundSummary/>}/>
            <Route path="/inbound/detail"      element={<InboundDetail/>}/>
            <Route path="/rental-history"      element={<RentalHistory/>}/>
            <Route path="/delivery-history"    element={<DeliveryHistory/>}/>
            <Route path="/settings"            element={<Settings/>}/>
          </Routes>
        </main>
      </div>
    </div>
  )
}
