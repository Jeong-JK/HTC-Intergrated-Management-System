import { Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { invPath, goHub } from '../site.js'
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
  { to: invPath(),         icon: LayoutDashboard, label: '재고현황' },
  { to: invPath('/stock-detail'), icon: ListFilter, label: '재고상세' },
  { to: invPath('/calendar'), icon: Calendar,        label: '대여캘린더' },
  {
    label: '재고', icon: Package, children: [
      { to: invPath('/stock/radio'),     label: '라디오' },
      { to: invPath('/stock/antenna'),   label: '안테나' },
      { to: invPath('/stock/accessory'), label: '악세사리' },
      { to: invPath('/stock/specs'),     label: '상세정보' },
    ]
  },
  {
    label: '출고', icon: Truck, children: [
      { to: invPath('/out/rental'),   label: '대여' },
      { to: invPath('/out/delivery'), label: '납품' },
    ]
  },
  {
    label: '입고', icon: PackagePlus, children: [
      { to: invPath('/inbound'), end: true, label: '제품 입고' },
      { to: invPath('/inbound/summary'), label: '입고 요약' },
      { to: invPath('/inbound/detail'),  label: '입고 상세' },
    ]
  },
  { to: invPath('/rental-history'),   icon: ClipboardList, label: '대여이력' },
  { to: invPath('/delivery-history'), icon: ClipboardList, label: '납품이력' },
  { to: invPath('/settings'), icon: Settings2, label: '드롭다운 관리' },
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
              <NavLink key={c.to} to={c.to} end={c.to === invPath('/inbound')}
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
    <NavLink to={item.to} end={item.to === invPath()}
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
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768)

  useEffect(() => {
    document.title = 'HTC 재고관리'
  }, [])

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-bg">
      {/* 헤더: Sales Pipeline과 같은 배치 (메인으로 + 메인허브 카드 마크) */}
      <header className="pl-16 pr-3 sm:pr-6 md:pl-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-3 bg-white border-b border-slate-200">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <button onClick={goHub} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50 transition-colors">
            <Home size={16}/>
            메인으로
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <Package size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-800">재고관리</h1>
              <p className="hidden sm:block text-sm text-slate-500">장비 재고, 입출고, 대여/납품 관리</p>
            </div>
          </div>
        </div>
        <AlertBell />
      </header>
      <div className="flex flex-1 overflow-hidden">
        <Sidebar open={sidebarOpen} setOpen={setSidebarOpen}/>
        <main className="flex-1 overflow-auto bg-bg pl-14 md:pl-0">
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
