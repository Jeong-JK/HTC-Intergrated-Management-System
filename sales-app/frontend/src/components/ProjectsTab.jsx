import { useState, useEffect, useRef } from 'react'
import { Search, Plus, Edit2, Trash2, Save, X, ChevronUp } from 'lucide-react'
import { getProjects, getProjectStats, createProject, updateProject, deleteProject, getPurchasesByPONumber } from '../api'
import ProjectModal from './ProjectModal'
import PurchaseItemSelectModal from './PurchaseItemSelectModal'
import Combobox from './Combobox'
import { STATUS_OPTIONS, PROJECT_COLORS, parseDate } from '../utils/projectCommon'

const getProjectColor = (projectNo) => {
  if (!projectNo) return PROJECT_COLORS[0]
  // 프로젝트 번호에서 숫자 추출 (예: "26-01" -> "01")
  const match = projectNo.match(/\d+$/)
  if (!match) return PROJECT_COLORS[0]
  const num = parseInt(match[0], 10)
  return PROJECT_COLORS[num % PROJECT_COLORS.length]
}

// Supplier별 배경색 반환 (매입관리와 동일)
const getSupplierBgColor = (supplier) => {
  switch (supplier) {
    case 'Silvus':
      return 'bg-pink-200'
    case 'SWA':
      return 'bg-orange-200'
    case 'Octane':
      return 'bg-sky-200'
    case 'Bren-Tronics':
      return 'bg-green-200'
    case '퓨리원':
      return 'bg-green-100'
    case '국제전파':
      return 'bg-yellow-100'
    default:
      return 'bg-gray-200'
  }
}

// 수금현황 퍼센트별 배경색 (0%: 진한분홍 → 100%: 회색)
// 송금현황/수금현황 퍼센트별 인라인 스타일 (매입관리와 동일)
const getPaymentStatusStyle = (percent) => {
  const p = parseFloat(percent) || 0

  // 100% 이상: 회색 (옅은 회색)
  if (p >= 100) return { backgroundColor: '#e2e8f0', color: '#64748b' }

  // 80-99%: 연한 회색
  if (p >= 80) return { backgroundColor: '#f1f5f9', color: '#64748b' }

  // 60-79%: 아주 옅은 핑크
  if (p >= 60) return { backgroundColor: '#fce7f3', color: '#9f1239' }

  // 40-59%: 옅은 핑크
  if (p >= 40) return { backgroundColor: '#fbcfe8', color: '#9f1239' }

  // 20-39%: 핑크
  if (p >= 20) return { backgroundColor: '#f9a8d4', color: '#831843' }

  // 0-19%: 밝은 빨강
  return { backgroundColor: '#f87171', color: '#ffffff' }
}

export default function ProjectsTab({ year, isActive, hideDone }) {
  const [projects, setProjects] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [selectedProject, setSelectedProject] = useState(null)
  const [editingCell, setEditingCell] = useState(null) // { projectId, field, rowIndex }
  const [editValue, setEditValue] = useState('')
  const [showScrollTop, setShowScrollTop] = useState(false)
  const tableContainerRef = useRef(null)
  // 품목 선택 모달
  const [selectModal, setSelectModal] = useState({ show: false, items: [], projectId: null, itemIndex: null, poNumber: null })

  useEffect(() => {
    loadData()
  }, [year])

  const scrollToTop = () => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // 탭 활성화 시 데이터 새로고침 (매입관리 연동)
  useEffect(() => {
    if (isActive) {
      loadData(true)
    }
  }, [isActive])

  const loadData = async (preserveScroll = false) => {
    // 스크롤 위치 저장
    const scrollTop = preserveScroll && tableContainerRef.current ? tableContainerRef.current.scrollTop : 0
    const scrollLeft = preserveScroll && tableContainerRef.current ? tableContainerRef.current.scrollLeft : 0

    try {
      // 스크롤 유지 시에는 로딩 상태 변경 안 함 (테이블 유지)
      if (!preserveScroll) {
        setLoading(true)
      }
      const [projectsRes, statsRes] = await Promise.all([
        getProjects({ year }),
        getProjectStats({ year })
      ])
      setProjects(projectsRes.data)
      setStats(statsRes.data)
    } catch (error) {
      console.error('데이터 로딩 실패:', error)
    } finally {
      if (!preserveScroll) {
        setLoading(false)
      }
      // 스크롤 위치 복원
      if (preserveScroll && tableContainerRef.current) {
        requestAnimationFrame(() => {
          if (tableContainerRef.current) {
            tableContainerRef.current.scrollTop = scrollTop
            tableContainerRef.current.scrollLeft = scrollLeft
          }
        })
      }
    }
  }

  const handleAddProject = () => {
    // 신규 프로젝트용 빈 객체 (year만 설정)
    setSelectedProject({ year: year || 2026 })
    setShowModal(true)
  }

  const handleEditProject = async (projectId) => {
    try {
      const project = projects.find(p => p.id === projectId)
      setSelectedProject(project)
      setShowModal(true)
    } catch (error) {
      console.error('프로젝트 로딩 실패:', error)
      alert('프로젝트를 불러오는데 실패했습니다')
    }
  }

  const handleSaveProject = async (formData) => {
    try {
      if (selectedProject?.id) {
        // 기존 프로젝트 수정
        await updateProject(selectedProject.id, formData)
        alert('프로젝트가 수정되었습니다')
      } else {
        // 신규 프로젝트 추가
        await createProject(formData)
        alert('프로젝트가 추가되었습니다')
      }
      setShowModal(false)
      setSelectedProject(null)
      loadData(true)
    } catch (error) {
      console.error('저장 실패:', error)
      const detail = error.response?.data?.detail
      const msg = typeof detail === 'object' ? JSON.stringify(detail) : (detail || error.message || '저장에 실패했습니다')
      alert(msg)
    }
  }

  const handleDeleteProject = async (projectId) => {
    if (!confirm('정말 삭제하시겠습니까?')) return
    try {
      await deleteProject(projectId)
      alert('프로젝트가 삭제되었습니다')
      loadData(true)
    } catch (error) {
      console.error('삭제 실패:', error)
      const detail = error.response?.data?.detail
      const msg = typeof detail === 'object' ? JSON.stringify(detail) : (detail || error.message || '삭제에 실패했습니다')
      alert(msg)
    }
  }

  const handleCellDoubleClick = (type, projectId, field, currentValue, itemIndex = null) => {
    // 매입 품목명은 직접 수정 불가
    if (type === 'purchase' && field === 'product_name') {
      alert('발주서 번호를 입력 후 검색 버튼을 눌러주세요')
      return
    }

    setEditingCell({ type, projectId, field, itemIndex })

    // 날짜 필드는 YYYY-MM-DD 형식으로 정규화
    if ((field === 'order_date' || field === 'delivery_date' || field === 'expected_date' || field === 'payment_date') && currentValue) {
      const dateStr = String(currentValue).split('T')[0].split(' ')[0]
      setEditValue(dateStr)
    } else if (currentValue !== null && currentValue !== undefined) {
      // 객체인 경우 JSON으로 변환
      setEditValue(typeof currentValue === 'object' ? JSON.stringify(currentValue) : String(currentValue))
    } else {
      setEditValue('')
    }
  }

  const handleCellSave = async () => {
    if (!editingCell) return

    try {
      const { type, projectId, field, itemIndex } = editingCell
      const project = projects.find(p => p.id === projectId)
      if (!project) return

      if (type === 'project') {
        // 프로젝트 기본 필드 수정
        // 날짜 필드는 파싱 후 빈 문자열을 null로 변환
        const dateFields = ['order_date', 'delivery_date', 'payment_date']
        let value = editValue
        if (dateFields.includes(field)) {
          value = editValue?.trim() ? parseDate(editValue) : null
        }
        await updateProject(projectId, { [field]: value })
      } else if (type === 'sales') {
        // 판매 항목 수정
        const salesItems = [...(project.sales_items || [])]
        if (salesItems[itemIndex]) {
          salesItems[itemIndex] = { ...salesItems[itemIndex], [field]: field === 'quantity' || field === 'unit_price' || field === 'total_price' ? parseFloat(editValue) || 0 : editValue }
          // 수량 또는 단가 변경 시 총금액 자동 계산
          if (field === 'quantity' || field === 'unit_price') {
            salesItems[itemIndex].total_price = (salesItems[itemIndex].quantity || 0) * (salesItems[itemIndex].unit_price || 0)
          }
          await updateProject(projectId, { sales_items: salesItems })
        }
      } else if (type === 'purchase') {
        // 매입 항목 수정
        const purchaseItems = [...(project.purchase_items || [])]
        if (purchaseItems[itemIndex]) {
          const numericFields = ['quantity', 'unit_price_usd', 'unit_price_krw', 'total_price_usd', 'total_price_krw', 'exchange_rate', 'payment_status']
          const dateFieldsPurchase = ['expected_date']
          let fieldValue = editValue
          if (dateFieldsPurchase.includes(field)) {
            fieldValue = editValue?.trim() ? parseDate(editValue) : null
          } else if (numericFields.includes(field)) {
            fieldValue = parseFloat(editValue) || 0
          }
          purchaseItems[itemIndex] = { ...purchaseItems[itemIndex], [field]: fieldValue }
          // 수량/단가 변경 시 총금액 자동 계산
          if (field === 'quantity' || field === 'unit_price_usd' || field === 'exchange_rate') {
            const item = purchaseItems[itemIndex]
            item.total_price_usd = (item.quantity || 0) * (item.unit_price_usd || 0)
            item.unit_price_krw = (item.unit_price_usd || 0) * (item.exchange_rate || 0)
            item.total_price_krw = item.total_price_usd * (item.exchange_rate || 0)
          }
          await updateProject(projectId, { purchase_items: purchaseItems })
        }
      }

      loadData(true)
      setEditingCell(null)
    } catch (error) {
      console.error('수정 실패:', error)
      const detail = error.response?.data?.detail
      const msg = typeof detail === 'object' ? JSON.stringify(detail) : (detail || error.message || '수정에 실패했습니다')
      alert(msg)
    }
  }

  const handleCellCancel = () => {
    setEditingCell(null)
    setEditValue('')
  }

  // 발주서 번호 입력 시 품목 선택 모달 표시
  const handlePONumberBlur = async (projectId, itemIndex, poNumber) => {
    if (!poNumber?.trim()) {
      handleCellSave()
      return
    }

    try {
      const response = await getPurchasesByPONumber(poNumber.trim(), year)
      const items = response.data  // API는 배열 직접 반환

      if (Array.isArray(items) && items.length > 0) {
        // 품목 선택 모달 표시
        setEditingCell(null)
        setSelectModal({ show: true, items, projectId, itemIndex, poNumber: poNumber.trim() })
      } else {
        alert(`발주서 "${poNumber}"를 매입관리에서 찾을 수 없습니다.`)
        handleCellCancel()
      }
    } catch (error) {
      console.error('발주서 조회 실패:', error)
      alert('발주서 조회에 실패했습니다.')
      handleCellCancel()
    }
  }

  // 품목 선택 완료
  const handleSelectPurchaseItems = async (selectedItems) => {
    const { projectId, itemIndex, poNumber } = selectModal

    try {
      const project = projects.find(p => p.id === projectId)
      if (!project) return

      // 기존 매입 항목 중 현재 편집 중인 행이 아닌 것들만 유지
      const existingItems = (project.purchase_items || []).filter(
        (item, idx) => idx !== itemIndex
      )

      // 선택한 품목들을 매입 항목으로 변환
      const newPurchaseItems = selectedItems.map(purchaseItem => {
        const quantity = purchaseItem.quantity || 1
        const netPrice = purchaseItem.net_price || 0
        const currency = purchaseItem.currency || 'USD'

        // 통화별 단가/금액 설정
        let unitPriceUsd = 0
        let unitPriceKrw = 0
        let totalPriceUsd = 0
        let totalPriceKrw = 0
        let exchangeRate = null

        if (currency === 'KRW') {
          // KRW 물품: 단가(원화)만 표시, 환율 불필요
          unitPriceKrw = netPrice
          totalPriceKrw = netPrice * quantity
          unitPriceUsd = 0
          totalPriceUsd = 0
          exchangeRate = null
        } else {
          // USD 물품: 단가($)만 표시, 총금액(원화)는 환율 적용
          // 개별 환율 → 같은 PO 공통 환율 (API에서 제공)
          exchangeRate = purchaseItem.exchange_rate1 || purchaseItem.exchange_rate2 || purchaseItem.po_exchange_rate || null
          unitPriceUsd = netPrice
          totalPriceUsd = netPrice * quantity
          unitPriceKrw = 0  // 단가(원화)는 비움
          totalPriceKrw = exchangeRate ? totalPriceUsd * exchangeRate : 0  // 총금액(원화) = 총금액($) × 환율
        }

        return {
          po_number: poNumber,
          supplier: purchaseItem.supplier,
          product_name: purchaseItem.product_name,
          quantity: quantity,
          unit_price_usd: unitPriceUsd,
          unit_price_krw: unitPriceKrw,
          total_price_usd: totalPriceUsd,
          total_price_krw: totalPriceKrw,
          exchange_rate: exchangeRate,
          expected_date: purchaseItem.expected_date,
          received_status: purchaseItem.received_status || '미입고',
          payment_status: null  // 송금은 사용자가 직접 입력
        }
      })

      // 기존 항목 + 선택한 새 항목
      const allPurchaseItems = [...existingItems, ...newPurchaseItems]

      // Shipping 품목에 대응하는 판매 빈 행 추가
      const existingSalesItems = [...(project.sales_items || [])]
      const shippingCount = newPurchaseItems.filter(item =>
        item.product_name?.toLowerCase().includes('shipping')
      ).length

      // shipping 개수만큼 판매쪽에 빈 행 추가
      for (let i = 0; i < shippingCount; i++) {
        existingSalesItems.push({
          product_name: '-',
          quantity: null,
          unit_price: null,
          total_price: null
        })
      }

      await updateProject(projectId, {
        purchase_items: allPurchaseItems,
        sales_items: existingSalesItems
      })
      loadData(true)
    } catch (error) {
      console.error('품목 추가 실패:', error)
      alert('품목 추가에 실패했습니다.')
    }
  }

  // 빈 매입 항목에 발주서 추가
  const handleAddPurchaseByPO = async (projectId) => {
    const poNumber = prompt('매입관리에 등록된 발주서 번호를 입력하세요:')
    if (!poNumber?.trim()) return

    await handlePONumberBlur(projectId, -1, poNumber)
  }

  // 프로젝트 매입 데이터 동기화 (매입관리에서 최신 데이터 가져오기)
  const handleSyncProject = async (projectId) => {
    try {
      const project = projects.find(p => p.id === projectId)
      if (!project) return

      const purchaseItems = project.purchase_items || []
      if (purchaseItems.length === 0) {
        alert('동기화할 매입 품목이 없습니다.')
        return
      }

      // 고유한 PO 번호들 추출
      const poNumbers = [...new Set(purchaseItems.map(item => item.po_number).filter(Boolean))]
      if (poNumbers.length === 0) {
        alert('PO 번호가 없는 품목입니다.')
        return
      }

      // 각 PO에 대해 매입관리에서 최신 데이터 가져오기
      const allPurchaseData = []
      for (const poNumber of poNumbers) {
        const response = await getPurchasesByPONumber(poNumber, year)
        const items = response.data
        if (Array.isArray(items)) {
          allPurchaseData.push(...items.map(item => ({ ...item, po_number: poNumber })))
        }
      }

      // 기존 purchase_items의 product_name + po_number 조합으로 매칭하여 업데이트
      let missingExchangeRateCount = 0
      const updatedPurchaseItems = purchaseItems.map(existingItem => {
        // 매입관리에서 매칭되는 품목 찾기
        const matchedPurchase = allPurchaseData.find(p =>
          p.po_number === existingItem.po_number &&
          p.product_name === existingItem.product_name
        )

        if (!matchedPurchase) return existingItem // 매칭 안 되면 기존 데이터 유지

        const quantity = matchedPurchase.quantity || 1
        const netPrice = matchedPurchase.net_price || 0
        const currency = matchedPurchase.currency || 'USD'

        let unitPriceUsd = 0
        let unitPriceKrw = 0
        let totalPriceUsd = 0
        let totalPriceKrw = 0
        let exchangeRate = null

        if (currency === 'KRW') {
          unitPriceKrw = netPrice
          totalPriceKrw = netPrice * quantity
        } else {
          exchangeRate = matchedPurchase.exchange_rate1 || matchedPurchase.exchange_rate2 || matchedPurchase.po_exchange_rate || null
          unitPriceUsd = netPrice
          totalPriceUsd = netPrice * quantity
          // 환율이 있으면 새로 계산, 없으면 기존 값 유지 (0으로 초기화 방지)
          if (exchangeRate) {
            unitPriceKrw = unitPriceUsd * exchangeRate
            totalPriceKrw = totalPriceUsd * exchangeRate
          } else {
            unitPriceKrw = existingItem.unit_price_krw || 0
            totalPriceKrw = existingItem.total_price_krw || 0
            if (totalPriceUsd > 0) missingExchangeRateCount++ // 환율 누락 카운트
          }
        }

        return {
          ...existingItem,
          supplier: matchedPurchase.supplier,
          quantity: quantity,
          unit_price_usd: unitPriceUsd,
          unit_price_krw: unitPriceKrw,
          total_price_usd: totalPriceUsd,
          total_price_krw: totalPriceKrw,
          exchange_rate: exchangeRate || existingItem.exchange_rate, // 환율도 기존 값 유지
          expected_date: matchedPurchase.expected_date,
          received_status: matchedPurchase.received_status || '미입고',
          // payment_status는 기존 값 유지 (사용자가 직접 입력)
        }
      })

      await updateProject(projectId, { purchase_items: updatedPurchaseItems })
      loadData(true)

      if (missingExchangeRateCount > 0) {
        alert(`매입 데이터가 동기화되었습니다.\n\n⚠ 경고: ${missingExchangeRateCount}개 USD 항목에 환율이 없습니다.\n기존 환율 값이 유지되었습니다.\n\n매입관리에서 환율을 입력한 후 다시 동기화하세요.`)
      } else {
        alert('매입 데이터가 동기화되었습니다.')
      }
    } catch (error) {
      console.error('동기화 실패:', error)
      alert('동기화에 실패했습니다.')
    }
  }

  const formatCurrency = (amount) => {
    if (!amount) return '₩0'
    return `₩${Math.round(amount).toLocaleString()}`
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    // YYYY-MM-DD 형식이면 yy.mm.dd로 변환, 아니면 원본 그대로 반환
    const fullDate = String(dateStr).split('T')[0]
    const parts = fullDate.split('-')
    if (parts.length === 3 && parts[0].length === 4) {
      const [year, month, day] = parts
      return `${year.slice(2)}.${month}.${day}`
    }
    return fullDate  // 텍스트 그대로 반환
  }

  const getRowColorStyle = (status) => {
    if (status === '완료') return { backgroundColor: '#e5e7eb', color: '#64748b' }
    if (status === '납기체크') return { backgroundColor: '#ffffb0' }
    if (status === '수금필요') return { backgroundColor: '#bbf7d0' }
    return { backgroundColor: '#ffffff' }
  }

  const getStatusBadgeStyle = (status) => {
    if (status === '완료') return { backgroundColor: '#cbd5e1', color: '#334155' }
    if (status === '납기체크') return { backgroundColor: '#ffffb0', color: '#000000' }
    if (status === '수금필요') return { backgroundColor: '#bbf7d0', color: '#000000' }
    return { backgroundColor: '#ffffff', border: '1px solid #cbd5e1', color: '#475569' }
  }

  const formatStatusText = (status) => {
    if (status === '납기체크') return '납기\n체크'
    if (status === '수금필요') return '수금\n필요'
    return status
  }

  const filteredProjects = projects.filter(p => {
    const matchSearch = !searchTerm ||
      p.project_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.customer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.project_name?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchSearch && !(hideDone && p.status === '완료')
  })

  // 프로젝트별로 행 데이터 생성 (row_index로 판매/매입 매칭)
  const generateTableRows = () => {
    const rows = []

    filteredProjects.forEach(project => {
      const salesItems = project.sales_items || []
      const purchaseItems = project.purchase_items || []
      const payments = project.payments || []

      // 배열 인덱스 기반으로 매칭 (판매/매입/수금 중 가장 많은 개수만큼 행 생성)
      const maxRows = Math.max(salesItems.length, purchaseItems.length, payments.length, 1)

      // 계산 필드
      const totalPurchaseKrw = purchaseItems.reduce((sum, item) => sum + (item.total_price_krw || 0), 0)
      const avgExchangeRate = purchaseItems.length > 0
        ? purchaseItems.reduce((sum, item) => sum + (item.exchange_rate || 0), 0) / purchaseItems.filter(i => i.exchange_rate).length
        : 0
      const marginRate = project.order_amount > 0
        ? ((project.order_amount - totalPurchaseKrw) / project.order_amount * 100)
        : 0
      const grossProfit = project.order_amount - totalPurchaseKrw

      // maxRows 만큼 행 생성 (판매/매입/수금 중 가장 많은 개수)
      for (let idx = 0; idx < maxRows; idx++) {
        rows.push({
          project,
          salesItem: salesItems[idx] || null,
          purchaseItem: purchaseItems[idx] || null,
          payment: payments[idx] || null,
          rowIndex: idx,
          rowSpan: maxRows,
          isFirstRow: idx === 0,
          totalPurchaseKrw,
          avgExchangeRate,
          marginRate,
          grossProfit,
          payments
        })
      }
    })

    return rows
  }

  const tableRows = generateTableRows()

  if (loading) {
    return <div className="text-center py-12 text-slate-500">로딩 중...</div>
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3">
            <div className="text-xs text-blue-700 mb-1">전체 프로젝트</div>
            <div className="text-xl font-bold text-blue-900">{stats.total_projects || 0}</div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3">
            <div className="text-xs text-green-700 mb-1">총 수주금액</div>
            <div className="text-xl font-bold text-green-900">{formatCurrency(stats.total_order_amount)}</div>
          </div>
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-3">
            <div className="text-xs text-emerald-700 mb-1">총 수금액</div>
            <div className="text-xl font-bold text-emerald-900">{formatCurrency(stats.total_payment_amount)}</div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3">
            <div className="text-xs text-purple-700 mb-1">완료 / 진행중</div>
            <div className="text-xl font-bold text-purple-900">
              {stats.completed_count || 0} / {stats.in_progress_count || 0}
            </div>
          </div>
        </div>
      )}

      {/* Search & Add Button */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
          <input
            type="text"
            placeholder="프로젝트 번호, 업체명, 프로젝트명 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <button
          onClick={handleAddProject}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
          <Plus size={18} />
          프로젝트 추가
        </button>
      </div>

      {/* Excel-style Table */}
      <div className="border border-slate-300 rounded-lg overflow-hidden shadow-sm">
        <div
          ref={tableContainerRef}
          className="overflow-auto"
          style={{ maxHeight: 'calc(100vh - 300px)' }}
          onScroll={(e) => setShowScrollTop(e.target.scrollTop > 200)}
        >
          <table className="min-w-max text-xs border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 border-b-2 border-slate-300 text-xs">
                {/* 액션 */}
                <th className="px-2 py-2 text-center font-semibold text-slate-700 border-r border-slate-400 w-16">액션</th>
                {/* 기본 정보 */}
                <th className="px-2 py-2 text-center font-semibold text-slate-700 border-r border-slate-300 w-12">상태</th>
                <th className="px-2 py-2 text-center font-semibold text-slate-700 border-r border-slate-300 w-20">No.</th>
                <th className="px-2 py-2 text-center font-semibold text-slate-700 border-r border-slate-300 w-36">업체명</th>
                <th className="px-2 py-2 text-center font-semibold text-slate-700 border-r border-slate-300 w-44">프로젝트명</th>
                <th className="px-2 py-2 text-center font-semibold text-slate-700 border-r border-slate-300 w-20">납기요청일</th>
                <th className="px-2 py-2 text-center font-semibold text-slate-700 border-r border-slate-300 w-24">수주금액</th>
                <th className="px-2 py-2 text-center font-semibold text-slate-700 border-r border-slate-300 w-24">수금일</th>
                <th className="px-2 py-2 text-center font-semibold text-slate-700 border-r border-slate-300 w-24">수금액</th>
                <th className="px-2 py-2 text-center font-semibold text-slate-700 border-r border-slate-400 w-16">수금현황</th>

                {/* 판매 */}
                <th className="px-2 py-2 text-center font-semibold text-blue-700 border-r border-slate-300 w-40">품목명</th>
                <th className="px-2 py-2 text-center font-semibold text-blue-700 border-r border-slate-300 w-10">수량</th>
                <th className="px-2 py-2 text-center font-semibold text-blue-700 border-r border-slate-300 w-20">단가</th>
                <th className="px-2 py-2 text-center font-semibold text-blue-700 border-r border-slate-300 w-24">총금액</th>

                {/* 매입 */}
                <th className="px-2 py-2 text-center font-semibold text-orange-700 border-r border-slate-300 w-24">공급사</th>
                <th className="px-2 py-2 text-center font-semibold text-orange-700 border-r border-slate-300 w-28">발주서</th>
                <th className="px-2 py-2 text-center font-semibold text-orange-700 border-r border-slate-300 w-40">품목명</th>
                <th className="px-2 py-2 text-center font-semibold text-orange-700 border-r border-slate-300 w-10">수량</th>
                <th className="px-2 py-2 text-center font-semibold text-orange-700 border-r border-slate-300 w-20">단가($)</th>
                <th className="px-2 py-2 text-center font-semibold text-orange-700 border-r border-slate-300 w-20">단가(₩)</th>
                <th className="px-2 py-2 text-center font-semibold text-orange-700 border-r border-slate-300 w-24">총금액($)</th>
                <th className="px-2 py-2 text-center font-semibold text-orange-700 border-r border-slate-300 w-24">총금액(₩)</th>
                <th className="px-2 py-2 text-center font-semibold text-orange-700 border-r border-slate-300 w-24">입고예정</th>
                <th className="px-2 py-2 text-center font-semibold text-orange-700 border-r border-slate-300 w-16">입고</th>
                <th className="px-2 py-2 text-center font-semibold text-orange-700 border-r border-slate-400 w-16">송금</th>

                {/* 계산 */}
                <th className="px-2 py-2 text-center font-semibold text-green-700 border-r border-slate-300 w-20">환율</th>
                <th className="px-2 py-2 text-center font-semibold text-green-700 border-r border-slate-300 w-24">매입(₩)</th>
                <th className="px-2 py-2 text-center font-semibold text-green-700 border-r border-slate-300 w-16">마진율</th>
                <th className="px-2 py-2 text-center font-semibold text-green-700 w-24">총이익</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.length === 0 ? (
                <tr>
                  <td colSpan="29" className="px-4 py-12 text-center text-slate-500">
                    프로젝트가 없습니다
                  </td>
                </tr>
              ) : (
                tableRows.map((row, idx) => {
                  const { project, salesItem, purchaseItem, rowIndex, rowSpan, isFirstRow,
                    totalPurchaseKrw, avgExchangeRate, marginRate, grossProfit, payments } = row
                  const rowStyle = getRowColorStyle(project.status)
                  const isLastRow = rowIndex === rowSpan - 1
                  const borderClass = isLastRow ? 'border-b-2 border-slate-400' : 'border-b border-slate-200'

                  return (
                    <tr key={`${project.id}-${rowIndex}`} className={`${borderClass} hover:brightness-95`} style={rowStyle}>
                      {/* 액션 (첫 행에만 표시) */}
                      {isFirstRow && (
                        <td rowSpan={rowSpan} className="px-1 py-1 text-center border-r border-slate-400">
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            <button
                              onClick={() => handleEditProject(project.id)}
                              className="px-2 py-0.5 bg-blue-500 text-white rounded text-[9px] font-medium hover:bg-blue-600"
                              title="수정">
                              수정
                            </button>
                            <button
                              onClick={() => handleDeleteProject(project.id)}
                              className="px-2 py-0.5 bg-orange-500 text-white rounded text-[9px] font-medium hover:bg-orange-600"
                              title="삭제">
                              삭제
                            </button>
                            <button
                              onClick={() => handleSyncProject(project.id)}
                              className="px-2 py-0.5 bg-green-500 text-white rounded text-[9px] font-medium hover:bg-green-600"
                              title="매입관리에서 최신 데이터 동기화">
                              동기화
                            </button>
                          </div>
                        </td>
                      )}

                      {/* 프로젝트 기본 정보 (첫 행에만 표시, rowspan) */}
                      {isFirstRow && (
                        <>
                          {/* 상태 */}
                          <td
                            rowSpan={rowSpan}
                            className="px-1 py-1 text-center border-r border-slate-300 cursor-pointer hover:bg-blue-50"
                            onDoubleClick={() => handleCellDoubleClick('project', project.id, 'status', project.status)}>
                            {editingCell?.projectId === project.id && editingCell?.field === 'status' && editingCell?.type === 'project' ? (
                              <select
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleCellSave()
                                  if (e.key === 'Escape') handleCellCancel()
                                }}
                                onBlur={handleCellSave}
                                autoFocus
                                className="w-full px-1 py-0.5 border border-blue-500 rounded text-[10px]">
                                <option value="진행중">진행중</option>
                                <option value="완료">완료</option>
                                <option value="납기체크">납기체크</option>
                                <option value="수금필요">수금필요</option>
                              </select>
                            ) : (
                              <span
                                className="inline-block px-1 py-0.5 rounded text-[10px] font-medium whitespace-pre-line leading-tight text-center"
                                style={getStatusBadgeStyle(project.status)}>
                                {formatStatusText(project.status) || '-'}
                              </span>
                            )}
                          </td>
                          {/* No. */}
                          <td
                            rowSpan={rowSpan}
                            className="px-2 py-1 text-center font-medium text-slate-800 border-r border-slate-300 cursor-pointer hover:bg-blue-50"
                            onDoubleClick={() => handleCellDoubleClick('project', project.id, 'order_date', project.order_date)}>
                            {editingCell?.projectId === project.id && editingCell?.field === 'order_date' && editingCell?.type === 'project' ? (
                              <div>
                                <div className="text-xs font-bold">{project.project_no}</div>
                                <input
                                  type="text"
                                  placeholder="YY.MM.DD"
                                  value={editValue || ''}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleCellSave()
                                    if (e.key === 'Escape') handleCellCancel()
                                  }}
                                  onBlur={handleCellSave}
                                  autoFocus
                                  className="w-full px-1 py-0.5 border border-blue-500 rounded text-[9px]"
                                />
                              </div>
                            ) : (
                              <>
                                <div className="text-sm font-bold text-slate-800">{project.project_no}</div>
                                <div className="text-[11px] font-medium text-blue-600">
                                  {project.order_date ?
                                    formatDate(project.order_date) :
                                    <span className="text-yellow-600 font-semibold">+발주일</span>
                                  }
                                </div>
                              </>
                            )}
                          </td>
                          {/* 업체명 */}
                          <td
                            rowSpan={rowSpan}
                            className="px-2 py-1 text-center text-slate-800 font-bold border-r border-slate-300 cursor-pointer hover:bg-blue-50"
                            onDoubleClick={() => handleCellDoubleClick('project', project.id, 'customer', project.customer)}>
                            {editingCell?.projectId === project.id && editingCell?.field === 'customer' && editingCell?.type === 'project' ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleCellSave()
                                    if (e.key === 'Escape') handleCellCancel()
                                  }}
                                  onBlur={handleCellSave}
                                  autoFocus
                                  className="w-full px-1 py-0.5 border border-blue-500 rounded text-sm font-bold"
                                />
                              </div>
                            ) : (
                              project.customer
                            )}
                          </td>
                          {/* 프로젝트명 */}
                          <td
                            rowSpan={rowSpan}
                            className="px-2 py-1 text-center text-slate-700 border-r border-slate-300 cursor-pointer hover:bg-blue-50"
                            onDoubleClick={() => handleCellDoubleClick('project', project.id, 'project_name', project.project_name)}>
                            {editingCell?.projectId === project.id && editingCell?.field === 'project_name' && editingCell?.type === 'project' ? (
                              <input
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleCellSave()
                                  if (e.key === 'Escape') handleCellCancel()
                                }}
                                onBlur={handleCellSave}
                                autoFocus
                                className="w-full px-1 py-0.5 border border-blue-500 rounded text-sm"
                              />
                            ) : (
                              project.project_name
                            )}
                          </td>
                          {/* 납기요청일 */}
                          <td
                            rowSpan={rowSpan}
                            className="px-2 py-1 text-center text-slate-600 font-bold border-r border-slate-300 cursor-pointer hover:bg-blue-50"
                            onDoubleClick={() => handleCellDoubleClick('project', project.id, 'delivery_date', project.delivery_date)}>
                            {editingCell?.projectId === project.id && editingCell?.field === 'delivery_date' && editingCell?.type === 'project' ? (
                              <input
                                type="text"
                                placeholder="YY.MM.DD"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleCellSave()
                                  if (e.key === 'Escape') handleCellCancel()
                                }}
                                onBlur={handleCellSave}
                                autoFocus
                                className="w-full px-1 py-0.5 border border-blue-500 rounded text-sm font-bold"
                              />
                            ) : (
                              formatDate(project.delivery_date)
                            )}
                          </td>
                          {/* 수주금액 */}
                          <td
                            rowSpan={rowSpan}
                            className="px-2 py-1 text-center text-slate-800 font-medium border-r border-slate-300 cursor-pointer hover:bg-blue-50"
                            onDoubleClick={() => handleCellDoubleClick('project', project.id, 'order_amount', project.order_amount)}>
                            {editingCell?.projectId === project.id && editingCell?.field === 'order_amount' && editingCell?.type === 'project' ? (
                              <input
                                type="number"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleCellSave()
                                  if (e.key === 'Escape') handleCellCancel()
                                }}
                                onBlur={handleCellSave}
                                autoFocus
                                className="w-full px-1 py-0.5 border border-blue-500 rounded text-sm"
                              />
                            ) : (
                              formatCurrency(project.order_amount)
                            )}
                          </td>
                          {/* 수금일 - 첫 행만 rowSpan, 나머지 행은 개별 */}
                          {payments && payments.length > 1 ? (
                            // 여러 수금 건이 있을 때
                            <>
                              <td className="px-2 py-1 text-center text-slate-600 border-r border-slate-300">
                                {payments[rowIndex]?.payment_date ? formatDate(payments[rowIndex].payment_date) : ''}
                              </td>
                              <td className="px-2 py-1 text-center text-blue-600 font-medium border-r border-slate-300">
                                {payments[rowIndex]?.payment_amount ? formatCurrency(payments[rowIndex].payment_amount) : ''}
                              </td>
                              {/* 수금현황 - 첫 행만 표시 */}
                              {rowIndex === 0 ? (
                                <td
                                  rowSpan={rowSpan}
                                  className="px-2 py-1 text-center border-r border-slate-400"
                                  style={project.order_amount > 0 ? getPaymentStatusStyle(((project.payment_amount || 0) / project.order_amount * 100).toFixed(0)) : {}}>
                                  {project.order_amount > 0 ? (
                                    <span className="text-[10px] font-bold">
                                      {((project.payment_amount || 0) / project.order_amount * 100).toFixed(0)}%
                                    </span>
                                  ) : '-'}
                                </td>
                              ) : null}
                            </>
                          ) : (
                            // 수금 건이 0-1개일 때 (기존 방식)
                            <>
                              <td
                                rowSpan={rowSpan}
                                className="px-2 py-1 text-center text-slate-600 border-r border-slate-300 cursor-pointer hover:bg-blue-50"
                                onDoubleClick={() => handleCellDoubleClick('project', project.id, 'payment_date', project.payment_date)}>
                                {editingCell?.projectId === project.id && editingCell?.field === 'payment_date' && editingCell?.type === 'project' ? (
                                  <input
                                    type="text"
                                    placeholder="YY.MM.DD"
                                    value={editValue || ''}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleCellSave()
                                      if (e.key === 'Escape') handleCellCancel()
                                    }}
                                    onBlur={handleCellSave}
                                    autoFocus
                                    className="w-full px-1 py-0.5 border border-blue-500 rounded text-xs"
                                  />
                                ) : (
                                  formatDate(project.payment_date)
                                )}
                              </td>
                              <td
                                rowSpan={rowSpan}
                                className="px-2 py-1 text-center text-blue-600 font-medium border-r border-slate-300 cursor-pointer hover:bg-blue-50"
                                onDoubleClick={() => handleCellDoubleClick('project', project.id, 'payment_amount', project.payment_amount)}>
                                {editingCell?.projectId === project.id && editingCell?.field === 'payment_amount' && editingCell?.type === 'project' ? (
                                  <input
                                    type="number"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleCellSave()
                                      if (e.key === 'Escape') handleCellCancel()
                                    }}
                                    onBlur={handleCellSave}
                                    autoFocus
                                    className="w-full px-1 py-0.5 border border-blue-500 rounded text-xs text-center"
                                  />
                                ) : (
                                  formatCurrency(project.payment_amount)
                                )}
                              </td>
                              <td
                                rowSpan={rowSpan}
                                className="px-2 py-1 text-center border-r border-slate-400"
                                style={project.order_amount > 0 ? getPaymentStatusStyle(((project.payment_amount || 0) / project.order_amount * 100).toFixed(0)) : {}}>
                                {project.order_amount > 0 ? (
                                  <span className="text-[10px] font-bold">
                                    {((project.payment_amount || 0) / project.order_amount * 100).toFixed(0)}%
                                  </span>
                                ) : '-'}
                              </td>
                            </>
                          )}
                        </>
                      )}

                      {/* 여러 수금 건이 있을 때 - isFirstRow가 아닌 행에서 수금 컬럼 렌더링 */}
                      {!isFirstRow && payments && payments.length > 1 && (
                        <>
                          <td className="px-2 py-1 text-center text-slate-600 border-r border-slate-300">
                            {payments[rowIndex]?.payment_date ? formatDate(payments[rowIndex].payment_date) : ''}
                          </td>
                          <td className="px-2 py-1 text-center text-blue-600 font-medium border-r border-slate-300">
                            {payments[rowIndex]?.payment_amount ? formatCurrency(payments[rowIndex].payment_amount) : ''}
                          </td>
                          {/* 수금현황은 첫 행에서만 rowSpan으로 표시됨 */}
                        </>
                      )}

                      {/* 판매 항목 */}
                      <td
                        className="px-2 py-1 text-center text-slate-700 border-r border-slate-300 cursor-pointer hover:bg-blue-50"
                        onDoubleClick={() => salesItem && handleCellDoubleClick('sales', project.id, 'product_name', salesItem.product_name, rowIndex)}>
                        {editingCell?.type === 'sales' && editingCell?.projectId === project.id && editingCell?.field === 'product_name' && editingCell?.itemIndex === rowIndex ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCellSave()
                              if (e.key === 'Escape') handleCellCancel()
                            }}
                            onBlur={handleCellSave}
                            autoFocus
                            className="w-full px-1 py-0.5 border border-blue-500 rounded text-xs"
                          />
                        ) : (
                          salesItem?.product_name || ''
                        )}
                      </td>
                      <td
                        className="px-2 py-1 text-center text-slate-600 border-r border-slate-300 cursor-pointer hover:bg-blue-50"
                        onDoubleClick={() => salesItem && handleCellDoubleClick('sales', project.id, 'quantity', salesItem.quantity, rowIndex)}>
                        {editingCell?.type === 'sales' && editingCell?.projectId === project.id && editingCell?.field === 'quantity' && editingCell?.itemIndex === rowIndex ? (
                          <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCellSave()
                              if (e.key === 'Escape') handleCellCancel()
                            }}
                            onBlur={handleCellSave}
                            autoFocus
                            className="w-full px-1 py-0.5 border border-blue-500 rounded text-xs text-center"
                          />
                        ) : (
                          salesItem?.quantity || ''
                        )}
                      </td>
                      <td
                        className="px-2 py-1 text-center text-slate-600 border-r border-slate-300 cursor-pointer hover:bg-blue-50"
                        onDoubleClick={() => salesItem && handleCellDoubleClick('sales', project.id, 'unit_price', salesItem.unit_price, rowIndex)}>
                        {editingCell?.type === 'sales' && editingCell?.projectId === project.id && editingCell?.field === 'unit_price' && editingCell?.itemIndex === rowIndex ? (
                          <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCellSave()
                              if (e.key === 'Escape') handleCellCancel()
                            }}
                            onBlur={handleCellSave}
                            autoFocus
                            className="w-full px-1 py-0.5 border border-blue-500 rounded text-xs text-right"
                          />
                        ) : (
                          salesItem ? ((salesItem.product_name === '-' && !salesItem.quantity && !salesItem.unit_price) ? '-' : formatCurrency(salesItem.unit_price)) : ''
                        )}
                      </td>
                      <td className="px-2 py-1 text-center text-slate-700 font-medium border-r border-slate-300">
                        {salesItem ? ((salesItem.product_name === '-' && !salesItem.quantity && !salesItem.unit_price) ? '-' : formatCurrency(salesItem.total_price)) : ''}
                      </td>

                      {/* 매입 항목 */}
                      <td
                        className={`px-2 py-1 text-center text-slate-700 border-r border-slate-300 cursor-pointer hover:brightness-95 ${project.status === '완료' ? '' : (purchaseItem?.supplier ? getSupplierBgColor(purchaseItem.supplier) : '')}`}
                        onDoubleClick={() => purchaseItem && handleCellDoubleClick('purchase', project.id, 'supplier', purchaseItem.supplier, rowIndex)}>
                        {editingCell?.type === 'purchase' && editingCell?.projectId === project.id && editingCell?.field === 'supplier' && editingCell?.itemIndex === rowIndex ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCellSave()
                              if (e.key === 'Escape') handleCellCancel()
                            }}
                            onBlur={handleCellSave}
                            autoFocus
                            className="w-full px-1 py-0.5 border border-blue-500 rounded text-xs"
                          />
                        ) : (
                          purchaseItem?.supplier || ''
                        )}
                      </td>
                      <td
                        className={`px-2 py-1 text-center text-[10px] border-r border-slate-300 cursor-pointer ${purchaseItem ? 'text-slate-600 hover:bg-yellow-50' : 'text-yellow-600 hover:bg-yellow-100'}`}
                        onDoubleClick={() => handleCellDoubleClick('purchase', project.id, 'po_number', purchaseItem?.po_number || '', rowIndex)}
                        title="발주서 번호 입력 시 매입관리에서 품목 자동완성">
                        {editingCell?.type === 'purchase' && editingCell?.projectId === project.id && editingCell?.field === 'po_number' && editingCell?.itemIndex === rowIndex ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                handlePONumberBlur(project.id, rowIndex, editValue)
                              }
                              if (e.key === 'Escape') handleCellCancel()
                            }}
                            onBlur={() => handlePONumberBlur(project.id, rowIndex, editValue)}
                            autoFocus
                            placeholder="PO번호 입력"
                            className="w-full px-1 py-0.5 border border-yellow-500 rounded text-xs bg-yellow-50"
                          />
                        ) : (
                          purchaseItem?.po_number || (rowIndex === 0 ? <span className="text-yellow-500 text-[9px]">+PO입력</span> : '')
                        )}
                      </td>
                      <td
                        className="px-2 py-1 text-center text-slate-600 border-r border-slate-300 cursor-not-allowed"
                        title="발주서 번호로 검색하여 불러오세요"
                        onDoubleClick={() => purchaseItem && handleCellDoubleClick('purchase', project.id, 'product_name', purchaseItem.product_name, rowIndex)}>
                        {purchaseItem?.product_name || ''}
                      </td>
                      <td
                        className="px-2 py-1 text-center text-slate-600 border-r border-slate-300 cursor-pointer hover:bg-blue-50"
                        onDoubleClick={() => purchaseItem && handleCellDoubleClick('purchase', project.id, 'quantity', purchaseItem.quantity, rowIndex)}>
                        {editingCell?.type === 'purchase' && editingCell?.projectId === project.id && editingCell?.field === 'quantity' && editingCell?.itemIndex === rowIndex ? (
                          <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCellSave()
                              if (e.key === 'Escape') handleCellCancel()
                            }}
                            onBlur={handleCellSave}
                            autoFocus
                            className="w-full px-1 py-0.5 border border-blue-500 rounded text-xs text-center"
                          />
                        ) : (
                          purchaseItem?.quantity || ''
                        )}
                      </td>
                      <td
                        className="px-2 py-1 text-center text-slate-600 border-r border-slate-300 cursor-pointer hover:bg-blue-50"
                        onDoubleClick={() => purchaseItem && handleCellDoubleClick('purchase', project.id, 'unit_price_usd', purchaseItem.unit_price_usd, rowIndex)}>
                        {editingCell?.type === 'purchase' && editingCell?.projectId === project.id && editingCell?.field === 'unit_price_usd' && editingCell?.itemIndex === rowIndex ? (
                          <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCellSave()
                              if (e.key === 'Escape') handleCellCancel()
                            }}
                            onBlur={handleCellSave}
                            autoFocus
                            className="w-full px-1 py-0.5 border border-blue-500 rounded text-xs text-right"
                          />
                        ) : (
                          purchaseItem ? (purchaseItem.unit_price_usd ? `$${purchaseItem.unit_price_usd.toLocaleString()}` : '-') : ''
                        )}
                      </td>
                      <td className="px-2 py-1 text-center text-slate-600 border-r border-slate-300">
                        {purchaseItem ? (purchaseItem.unit_price_krw ? formatCurrency(purchaseItem.unit_price_krw) : '-') : ''}
                      </td>
                      <td className="px-2 py-1 text-center text-slate-700 font-medium border-r border-slate-300">
                        {purchaseItem ? `$${purchaseItem.total_price_usd?.toLocaleString() || 0}` : ''}
                      </td>
                      <td className="px-2 py-1 text-center text-slate-700 font-medium border-r border-slate-300">
                        {purchaseItem ? formatCurrency(purchaseItem.total_price_krw) : ''}
                      </td>
                      <td
                        className="px-2 py-1 text-center text-slate-600 text-[10px] border-r border-slate-300 cursor-pointer hover:bg-blue-50"
                        onDoubleClick={() => purchaseItem && handleCellDoubleClick('purchase', project.id, 'expected_date', purchaseItem.expected_date, rowIndex)}>
                        {editingCell?.type === 'purchase' && editingCell?.projectId === project.id && editingCell?.field === 'expected_date' && editingCell?.itemIndex === rowIndex ? (
                          <input
                            type="text"
                            placeholder="YY.MM.DD"
                            value={editValue || ''}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCellSave()
                              if (e.key === 'Escape') handleCellCancel()
                            }}
                            onBlur={handleCellSave}
                            autoFocus
                            className="w-full px-1 py-0.5 border border-blue-500 rounded text-xs"
                          />
                        ) : (
                          formatDate(purchaseItem?.expected_date)
                        )}
                      </td>
                      <td
                        className="px-2 py-1 text-center border-r border-slate-300 cursor-pointer text-[9px] font-bold"
                        style={
                          (editingCell?.type === 'purchase' && editingCell?.projectId === project.id && editingCell?.field === 'received_status' && editingCell?.itemIndex === rowIndex) || !purchaseItem?.received_status
                            ? {}
                            : purchaseItem.received_status === '입고완료'
                            ? { backgroundColor: '#0a53a8', color: '#ffffff' }
                            : purchaseItem.received_status === '부분입고'
                            ? { backgroundColor: '#00ff00', color: '#000000' }
                            : {}
                        }
                        onDoubleClick={() => purchaseItem && handleCellDoubleClick('purchase', project.id, 'received_status', purchaseItem.received_status, rowIndex)}>
                        {editingCell?.type === 'purchase' && editingCell?.projectId === project.id && editingCell?.field === 'received_status' && editingCell?.itemIndex === rowIndex ? (
                          <select
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCellSave()
                              if (e.key === 'Escape') handleCellCancel()
                            }}
                            onBlur={handleCellSave}
                            autoFocus
                            className="w-full px-1 py-0.5 border border-blue-500 rounded text-[9px]">
                            <option value="미입고">미입고</option>
                            <option value="입고완료">입고완료</option>
                          </select>
                        ) : (
                          purchaseItem?.received_status === '입고완료' ? '입고완료' : ''
                        )}
                      </td>
                      <td
                        className="px-2 py-1 text-center border-r border-slate-400 cursor-pointer hover:brightness-95"
                        style={purchaseItem?.payment_status != null ? getPaymentStatusStyle((purchaseItem.payment_status * 100).toFixed(0)) : {}}
                        onDoubleClick={() => purchaseItem && handleCellDoubleClick('purchase', project.id, 'payment_status', purchaseItem.payment_status, rowIndex)}>
                        {editingCell?.type === 'purchase' && editingCell?.projectId === project.id && editingCell?.field === 'payment_status' && editingCell?.itemIndex === rowIndex ? (
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="1"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleCellSave()
                              if (e.key === 'Escape') handleCellCancel()
                            }}
                            onBlur={handleCellSave}
                            autoFocus
                            placeholder="0~1"
                            className="w-full px-1 py-0.5 border border-blue-500 rounded text-[10px] text-center"
                          />
                        ) : (
                          purchaseItem?.payment_status != null ? (
                            <span className="text-[10px] font-bold">
                              {(purchaseItem.payment_status * 100).toFixed(0)}%
                            </span>
                          ) : (purchaseItem ? '-' : '')
                        )}
                      </td>

                      {/* 계산 필드 (첫 행에만 표시) */}
                      {isFirstRow && (
                        <>
                          {/* 평균환율 */}
                          <td rowSpan={rowSpan} className="px-2 py-1 text-center text-green-700 font-medium border-r border-slate-300">
                            {avgExchangeRate > 0 ? avgExchangeRate.toFixed(2) : '-'}
                          </td>
                          {/* 전체매입(₩) */}
                          <td rowSpan={rowSpan} className="px-2 py-1 text-center text-orange-700 font-bold border-r border-slate-300">
                            {formatCurrency(totalPurchaseKrw)}
                          </td>
                          {/* 마진율 */}
                          <td rowSpan={rowSpan} className="px-2 py-1 text-center font-bold border-r border-slate-300">
                            <span className={marginRate >= 0 ? 'text-green-700' : 'text-red-600'}>
                              {marginRate.toFixed(2)}%
                            </span>
                          </td>
                          {/* 매출총이익 */}
                          <td rowSpan={rowSpan} className="px-2 py-1 text-center font-bold">
                            <span className={grossProfit >= 0 ? 'text-green-700' : 'text-red-600'}>
                              {formatCurrency(grossProfit)}
                            </span>
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 맨위로가기 버튼 */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 w-12 h-12 bg-green-600 text-white rounded-full shadow-lg hover:bg-green-700 flex items-center justify-center z-50 transition-all"
          title="맨 위로"
        >
          <ChevronUp size={24} />
        </button>
      )}

      <div className="text-xs text-slate-500 text-right">
        총 {filteredProjects.length}개 프로젝트
      </div>

      {/* 프로젝트 추가/수정 모달 */}
      {showModal && (
        <ProjectModal
          project={selectedProject}
          onSave={handleSaveProject}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* 품목 선택 모달 */}
      {selectModal.show && (
        <PurchaseItemSelectModal
          items={selectModal.items}
          onSelect={handleSelectPurchaseItems}
          onClose={() => setSelectModal({ show: false, items: [], projectId: null, itemIndex: null, poNumber: null })}
        />
      )}
    </div>
  )
}
