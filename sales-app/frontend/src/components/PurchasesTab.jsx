import { useState, useEffect, useRef } from 'react'
import { Search, Plus, Edit2, Trash2, Save, X, ChevronUp } from 'lucide-react'
import { getPurchases, getPurchaseStats, createPurchase, updatePurchase, deletePurchase } from '../api'
import Combobox from './Combobox'
import PurchaseModal from './PurchaseModal'
import { parseDate, SUPPLIER_OPTIONS, RECEIVED_STATUS_OPTIONS } from '../utils/projectCommon'

export default function PurchasesTab({ year }) {
  const [purchases, setPurchases] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingCell, setEditingCell] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [editingPurchase, setEditingPurchase] = useState(null)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const tableContainerRef = useRef(null)

  useEffect(() => {
    loadData()
  }, [year])

  const scrollToTop = () => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const loadData = async (preserveScroll = false) => {
    // 스크롤 위치 저장
    const scrollTop = preserveScroll && tableContainerRef.current ? tableContainerRef.current.scrollTop : 0
    const scrollLeft = preserveScroll && tableContainerRef.current ? tableContainerRef.current.scrollLeft : 0

    try {
      // 스크롤 유지 시에는 로딩 상태 변경 안 함 (테이블 유지)
      if (!preserveScroll) {
        setLoading(true)
      }
      const [purchasesRes, statsRes] = await Promise.all([
        getPurchases({ year }),
        getPurchaseStats({ year })
      ])
      setPurchases(purchasesRes.data)
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

  const handleAddPurchase = () => {
    // 신규 매입용 빈 객체 (year만 설정)
    setEditingPurchase({ year: year || new Date().getFullYear() })
  }

  const handleDeletePurchase = async (purchase) => {
    // 같은 PO의 모든 품목 찾기
    const samePOItems = purchases.filter(p => p.po_number === purchase.po_number)

    if (!confirm(`PO: ${purchase.po_number}의 모든 품목 ${samePOItems.length}개를 삭제하시겠습니까?`)) return

    try {
      // 같은 PO의 모든 품목 삭제
      for (const item of samePOItems) {
        await deletePurchase(item.id)
      }
      alert('매입이 삭제되었습니다')
      loadData()
    } catch (error) {
      console.error('삭제 실패:', error)
      const detail = error.response?.data?.detail
      const msg = typeof detail === 'object' ? JSON.stringify(detail) : (detail || error.message || '삭제에 실패했습니다')
      alert(msg)
    }
  }

  const handleSavePurchase = async (formData) => {
    // 모달에서 저장 완료 후 호출 (리로드만 필요)
    setEditingPurchase(null)
    loadData()
  }

  const handleCellDoubleClick = (purchaseId, field, currentValue) => {
    setEditingCell({ purchaseId, field })
    // 값을 문자열로 변환 (null, undefined, 객체 처리)
    let value = ''
    if (currentValue !== null && currentValue !== undefined) {
      if (typeof currentValue === 'object') {
        // Date 객체인 경우
        if (currentValue instanceof Date) {
          value = currentValue.toISOString().split('T')[0]
        } else {
          // 일반 객체는 JSON으로 표시
          value = JSON.stringify(currentValue)
        }
      } else {
        value = String(currentValue)
      }
    }
    setEditValue(value)
  }

  const handleCellSave = async () => {
    if (!editingCell) return

    try {
      const { purchaseId, field } = editingCell

      // 날짜 필드는 파싱 후 빈 값이면 null로 변환
      const dateFields = ['expected_date', 'payment_date1', 'payment_date2']
      let valueToSave = editValue
      if (dateFields.includes(field)) {
        valueToSave = editValue?.trim() ? parseDate(editValue) : null
      }

      await updatePurchase(purchaseId, { [field]: valueToSave })
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


  const formatCurrency = (amount) => {
    if (!amount) return '₩0'
    return `₩${Math.round(amount).toLocaleString()}`
  }

  const formatDollar = (amount) => {
    if (!amount) return '$0'
    return `$${parseFloat(amount).toLocaleString()}`
  }

  const formatAmount = (amount, currency) => {
    if (!amount) return currency === 'KRW' ? '₩0' : '$0'
    if (currency === 'KRW') {
      return `₩${Math.round(amount).toLocaleString()}`
    }
    return `$${parseFloat(amount).toLocaleString()}`
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
    return fullDate
  }

  const formatFullDate = (dateStr) => {
    if (!dateStr) return '-'
    // YYYY-MM-DD 형식이면 yy.mm.dd로 변환, 아니면 원본 그대로 반환
    const fullDate = String(dateStr).split('T')[0]
    const parts = fullDate.split('-')
    if (parts.length === 3 && parts[0].length === 4) {
      const [year, month, day] = parts
      return `${year.slice(2)}.${month}.${day}`
    }
    return fullDate
  }

  // Supplier별 배경색 반환
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

  // 송금현황 퍼센트별 인라인 스타일 (0% 빨강 → 점점 옅어지며 회색으로)
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

  // 송금현황 계산 (%)
  const calculatePaymentStatus = (purchase) => {
    // 합계금액 (quantity * net_price)
    const total = (purchase.quantity || 0) * (purchase.net_price || 0)
    if (total === 0) return 0

    // 송금액 합계 (항상 합계금액과 같은 통화로 입력되어 있음)
    const totalPaid = (purchase.payment_amount1 || 0) + (purchase.payment_amount2 || 0)

    return (totalPaid / total * 100).toFixed(0)
  }

  // 평균환율 계산
  const calculateAvgExchangeRate = (purchase) => {
    const rates = []
    if (purchase.exchange_rate1) rates.push(purchase.exchange_rate1)
    if (purchase.exchange_rate2) rates.push(purchase.exchange_rate2)
    if (rates.length === 0) return '환율미정'
    const avg = rates.reduce((sum, rate) => sum + rate, 0) / rates.length
    return avg.toFixed(2)
  }

  const filteredPurchases = purchases.filter(p => {
    const matchSearch = !searchTerm ||
      p.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.supplier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.project?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.product_name?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchSearch
  })

  // PO번호로 그룹화하여 테이블 행 데이터 생성
  const generateTableRows = () => {
    const rows = []
    const groups = {}

    // PO번호 + 품의번호로만 그룹화 (입고예정일 제외)
    filteredPurchases.forEach(purchase => {
      const poNum = purchase.po_number?.trim() || ''
      const reqNum = purchase.request_number?.trim() || ''
      const key = (poNum && reqNum)
        ? `${poNum}_${reqNum}`
        : (poNum || reqNum || `_no_group_${purchase.id}`)
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(purchase)
    })

    // 각 그룹의 행 생성 (USD와 KRW 분리)
    Object.values(groups).forEach(group => {
      // 개별 송금 여부 판단: payment_amount1이 자신의 amount와 같으면 개별 송금
      const isIndividualPayment = (p) => {
        const amount = p.quantity * p.net_price
        return p.payment_amount1 && Math.abs(p.payment_amount1 - amount) < 1  // 1원/달러 오차 허용
      }

      // USD와 KRW 분리
      const groupUSD = group.filter(p => p.currency === 'USD')
      const groupKRW = group.filter(p => p.currency === 'KRW')

      // 전체 그룹 크기 (PO, 품의번호 병합용)
      const totalGroupSize = group.length

      // USD 처리
      const individualUSD = groupUSD.filter(p => isIndividualPayment(p))
      const groupedUSD = groupUSD.filter(p => !isIndividualPayment(p))
      const groupedTotalUSD = groupedUSD.reduce((sum, p) => sum + (p.quantity * p.net_price), 0)

      // 그룹화된 USD 행들
      groupedUSD.forEach((purchase, idx) => {
        rows.push({
          purchase,
          isFirstInGroup: idx === 0,
          isFirstInTotalGroup: idx === 0,
          groupSize: groupedUSD.length,
          totalGroupSize: totalGroupSize,
          groupTotalAmount: groupedTotalUSD,
          groupCurrency: 'USD'
        })
      })

      // 개별 송금 USD 행들 (각각 개별로)
      individualUSD.forEach((purchase, idx) => {
        const amount = purchase.quantity * purchase.net_price
        rows.push({
          purchase,
          isFirstInGroup: true,
          isFirstInTotalGroup: groupedUSD.length === 0 && idx === 0,
          groupSize: 1,
          totalGroupSize: totalGroupSize,
          groupTotalAmount: amount,
          groupCurrency: 'USD'
        })
      })

      // KRW 처리
      const individualKRW = groupKRW.filter(p => isIndividualPayment(p))
      const groupedKRW = groupKRW.filter(p => !isIndividualPayment(p))
      const groupedTotalKRW = groupedKRW.reduce((sum, p) => sum + (p.quantity * p.net_price), 0)

      // 그룹화된 KRW 행들
      groupedKRW.forEach((purchase, idx) => {
        rows.push({
          purchase,
          isFirstInGroup: idx === 0,
          isFirstInTotalGroup: idx === 0 && groupUSD.length === 0,
          groupSize: groupedKRW.length,
          totalGroupSize: totalGroupSize,
          groupTotalAmount: groupedTotalKRW,
          groupCurrency: 'KRW'
        })
      })

      // 개별 송금 KRW 행들 (각각 개별로)
      individualKRW.forEach((purchase, idx) => {
        const amount = purchase.quantity * purchase.net_price
        rows.push({
          purchase,
          isFirstInGroup: true,
          isFirstInTotalGroup: groupedKRW.length === 0 && groupUSD.length === 0 && idx === 0,
          groupSize: 1,
          totalGroupSize: totalGroupSize,
          groupTotalAmount: amount,
          groupCurrency: 'KRW'
        })
      })
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
            <div className="text-xs text-blue-700 mb-1">전체 PO</div>
            <div className="text-xl font-bold text-blue-900">{stats.total_po_count || 0}</div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3">
            <div className="text-xs text-green-700 mb-1">총 매입금액</div>
            <div className="text-xl font-bold text-green-900">{formatCurrency(stats.total_amount_krw)}</div>
          </div>
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-3">
            <div className="text-xs text-emerald-700 mb-1">총 송금액</div>
            <div className="text-xl font-bold text-emerald-900">{formatCurrency(stats.total_paid_krw)}</div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3">
            <div className="text-xs text-purple-700 mb-1">입고완료 / 미입고</div>
            <div className="text-xl font-bold text-purple-900">
              {stats.received_count || 0} / {stats.not_received_count || 0}
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
            placeholder="PO, 공급사, 프로젝트, 품목명 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={handleAddPurchase}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <Plus size={18} />
          매입 추가
        </button>
      </div>

      {/* Excel-style Table */}
      <div className="border border-slate-300 rounded-lg overflow-hidden shadow-sm">
        <div
          ref={tableContainerRef}
          className="overflow-auto"
          style={{ maxHeight: 'calc(100vh - 320px)' }}
          onScroll={(e) => setShowScrollTop(e.target.scrollTop > 200)}
        >
          <table className="min-w-max text-xs border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 border-b-2 border-slate-300 text-xs">
                <th className="px-2 py-2 text-center font-semibold text-slate-700 border-r border-slate-400 w-20">액션</th>
                <th className="px-2 py-2 text-center font-semibold text-slate-700 border-r border-slate-300 w-32">PO</th>
                <th className="px-2 py-2 text-center font-semibold text-slate-700 border-r border-slate-300 w-32">Quote</th>
                <th className="px-2 py-2 text-center font-semibold text-slate-700 border-r border-slate-300 w-32">OC</th>
                <th className="px-2 py-2 text-center font-semibold text-slate-700 border-r border-slate-300 w-24">Invoice</th>
                <th className="px-2 py-2 text-center font-semibold text-slate-700 border-r border-slate-300 w-32">품의번호</th>
                <th className="px-2 py-2 text-center font-semibold text-slate-700 border-r border-slate-300 w-24">Supplier</th>
                <th className="px-2 py-2 text-center font-semibold text-slate-700 border-r border-slate-300 w-56">Project</th>
                <th className="px-2 py-2 text-center font-semibold text-slate-700 border-r border-slate-300 w-48">Products</th>
                <th className="px-2 py-2 text-center font-semibold text-slate-700 border-r border-slate-300 w-12">Q'ty</th>
                <th className="px-2 py-2 text-center font-semibold text-slate-700 border-r border-slate-300 w-16">Currency</th>
                <th className="px-2 py-2 text-center font-semibold text-slate-700 border-r border-slate-300 w-20">Net Price</th>
                <th className="px-2 py-2 text-center font-semibold text-slate-700 border-r border-slate-300 w-20">Amount</th>
                <th className="px-2 py-2 text-center font-semibold text-slate-700 border-r border-slate-300 w-28">Expected Date</th>
                <th className="px-2 py-2 text-center font-semibold text-slate-700 border-r border-slate-400 w-20">입고여부</th>
                <th className="px-2 py-2 text-center font-semibold text-green-700 border-r border-slate-300 w-24">합계금액</th>
                <th className="px-2 py-2 text-center font-semibold text-green-700 border-r border-slate-300 w-20">송금현황</th>
                <th className="px-2 py-2 text-center font-semibold text-green-700 border-r border-slate-300 w-24">송금일1</th>
                <th className="px-2 py-2 text-center font-semibold text-green-700 border-r border-slate-300 w-24">송금액1</th>
                <th className="px-2 py-2 text-center font-semibold text-green-700 border-r border-slate-300 w-20">환율1</th>
                <th className="px-2 py-2 text-center font-semibold text-green-700 border-r border-slate-300 w-24">송금일2</th>
                <th className="px-2 py-2 text-center font-semibold text-green-700 border-r border-slate-300 w-24">송금액2</th>
                <th className="px-2 py-2 text-center font-semibold text-green-700 border-r border-slate-300 w-20">환율2</th>
                <th className="px-2 py-2 text-center font-semibold text-green-700 w-20">평균환율</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.length === 0 ? (
                <tr>
                  <td colSpan="23" className="px-4 py-12 text-center text-slate-500">
                    매입 데이터가 없습니다
                  </td>
                </tr>
              ) : (
                tableRows.map(({ purchase, isFirstInGroup, isFirstInTotalGroup, groupSize, totalGroupSize, groupTotalAmount, groupCurrency }, idx) => {
                  // PO+품의번호 그룹이 바뀌는지 확인 (다음 행과 비교)
                  const nextRow = tableRows[idx + 1]
                  const currentKey = `${purchase.po_number}_${purchase.request_number}`
                  const nextKey = nextRow ? `${nextRow.purchase.po_number}_${nextRow.purchase.request_number}` : null
                  const isLastInPOGroup = !nextRow || currentKey !== nextKey
                  const borderClass = isLastInPOGroup ? 'border-b-2 border-slate-400' : 'border-b border-slate-200'

                  return (
                  <tr key={purchase.id} className={`${borderClass} hover:bg-slate-50`}>
                    {/* 액션 (전체 그룹의 첫 행에만 표시) */}
                    {isFirstInTotalGroup && (
                      <td rowSpan={totalGroupSize} className="px-1 py-1 text-center border-r border-slate-400">
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          <button
                            onClick={() => setEditingPurchase(purchase)}
                            className="px-2 py-0.5 bg-blue-500 text-white rounded text-[9px] font-medium hover:bg-blue-600"
                            title="수정">
                            수정
                          </button>
                          <button
                            onClick={() => handleDeletePurchase(purchase)}
                            className="px-2 py-0.5 bg-orange-500 text-white rounded text-[9px] font-medium hover:bg-orange-600"
                            title="삭제">
                            삭제
                          </button>
                        </div>
                      </td>
                    )}

                    {/* PO (전체 그룹의 첫 행에만 표시 - USD/KRW 구분 없이 병합) */}
                    {isFirstInTotalGroup && (
                      <td
                        rowSpan={totalGroupSize}
                        className="px-2 py-1 text-center text-slate-800 font-medium border-r border-slate-300 cursor-pointer hover:bg-blue-50 bg-slate-50"
                        onDoubleClick={() => handleCellDoubleClick(purchase.id, 'po_number', purchase.po_number)}>
                        {editingCell?.purchaseId === purchase.id && editingCell?.field === 'po_number' ? (
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
                          purchase.po_number
                        )}
                      </td>
                    )}

                    {/* Quote (매 행마다 표시) */}
                    <td
                      className="px-2 py-1 text-center text-slate-700 border-r border-slate-300 cursor-pointer hover:bg-blue-50"
                      onDoubleClick={() => handleCellDoubleClick(purchase.id, 'quote', purchase.quote)}>
                      {editingCell?.purchaseId === purchase.id && editingCell?.field === 'quote' ? (
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
                        purchase.quote || '-'
                      )}
                    </td>

                    {/* OC (매 행마다 표시) */}
                    <td
                      className="px-2 py-1 text-center text-slate-700 border-r border-slate-300 cursor-pointer hover:bg-blue-50"
                      onDoubleClick={() => handleCellDoubleClick(purchase.id, 'oc', purchase.oc)}>
                      {editingCell?.purchaseId === purchase.id && editingCell?.field === 'oc' ? (
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
                        purchase.oc || '-'
                      )}
                    </td>

                    {/* Invoice (매 행마다 표시) */}
                    <td
                      className="px-2 py-1 text-center text-slate-700 border-r border-slate-300 cursor-pointer hover:bg-blue-50"
                      onDoubleClick={() => handleCellDoubleClick(purchase.id, 'invoice', purchase.invoice)}>
                      {editingCell?.purchaseId === purchase.id && editingCell?.field === 'invoice' ? (
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
                        purchase.invoice || '-'
                      )}
                    </td>

                    {/* 품의번호 (전체 그룹의 첫 행에만 표시 - USD/KRW 구분 없이 병합) */}
                    {isFirstInTotalGroup && (
                      <td
                        rowSpan={totalGroupSize}
                        className="px-2 py-1 text-center text-slate-700 border-r border-slate-300 cursor-pointer hover:bg-blue-50 bg-slate-50"
                        onDoubleClick={() => handleCellDoubleClick(purchase.id, 'request_number', purchase.request_number)}>
                        {editingCell?.purchaseId === purchase.id && editingCell?.field === 'request_number' ? (
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
                          purchase.request_number || '-'
                        )}
                      </td>
                    )}

                    {/* Supplier */}
                    <td
                      className={`px-2 py-1 text-center text-slate-700 border-r border-slate-300 cursor-pointer hover:bg-blue-50 ${getSupplierBgColor(purchase.supplier)}`}
                      onDoubleClick={() => handleCellDoubleClick(purchase.id, 'supplier', purchase.supplier)}>
                      {editingCell?.purchaseId === purchase.id && editingCell?.field === 'supplier' ? (
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
                        purchase.supplier
                      )}
                    </td>

                    {/* Project */}
                    <td
                      className="px-2 py-1 text-center text-slate-700 border-r border-slate-300 cursor-pointer hover:bg-blue-50"
                      onDoubleClick={() => handleCellDoubleClick(purchase.id, 'project', purchase.project)}>
                      {editingCell?.purchaseId === purchase.id && editingCell?.field === 'project' ? (
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
                        purchase.project || '-'
                      )}
                    </td>

                    {/* Products */}
                    <td
                      className="px-2 py-1 text-center text-slate-700 border-r border-slate-300 cursor-pointer hover:bg-blue-50"
                      onDoubleClick={() => handleCellDoubleClick(purchase.id, 'product_name', purchase.product_name)}>
                      {editingCell?.purchaseId === purchase.id && editingCell?.field === 'product_name' ? (
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
                        purchase.product_name
                      )}
                    </td>

                    {/* Q'ty */}
                    <td
                      className="px-2 py-1 text-center text-slate-700 border-r border-slate-300 cursor-pointer hover:bg-blue-50"
                      onDoubleClick={() => handleCellDoubleClick(purchase.id, 'quantity', purchase.quantity)}>
                      {editingCell?.purchaseId === purchase.id && editingCell?.field === 'quantity' ? (
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
                        purchase.quantity
                      )}
                    </td>

                    {/* Currency */}
                    <td
                      className="px-2 py-1 text-center text-slate-700 border-r border-slate-300 cursor-pointer hover:bg-blue-50"
                      onDoubleClick={() => handleCellDoubleClick(purchase.id, 'currency', purchase.currency)}>
                      {editingCell?.purchaseId === purchase.id && editingCell?.field === 'currency' ? (
                        <select
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCellSave()
                            if (e.key === 'Escape') handleCellCancel()
                          }}
                          onBlur={handleCellSave}
                          autoFocus
                          className="w-full px-1 py-0.5 border border-blue-500 rounded text-xs">
                          <option value="USD">USD</option>
                          <option value="KRW">KRW</option>
                        </select>
                      ) : (
                        purchase.currency || 'USD'
                      )}
                    </td>

                    {/* Net Price */}
                    <td
                      className="px-2 py-1 text-center text-slate-700 border-r border-slate-300 cursor-pointer hover:bg-blue-50"
                      onDoubleClick={() => handleCellDoubleClick(purchase.id, 'net_price', purchase.net_price)}>
                      {editingCell?.purchaseId === purchase.id && editingCell?.field === 'net_price' ? (
                        <input
                          type="number"
                          step="0.01"
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
                        formatAmount(purchase.net_price, purchase.currency)
                      )}
                    </td>

                    {/* Amount (자동 계산) */}
                    <td className="px-2 py-1 text-center text-slate-800 font-medium border-r border-slate-300 bg-slate-50">
                      {formatAmount(purchase.quantity * purchase.net_price, purchase.currency)}
                    </td>

                    {/* Expected Date */}
                    <td
                      className="px-2 py-1 text-center text-slate-600 border-r border-slate-300 cursor-pointer hover:bg-blue-50"
                      onDoubleClick={() => handleCellDoubleClick(purchase.id, 'expected_date', purchase.expected_date)}>
                      {editingCell?.purchaseId === purchase.id && editingCell?.field === 'expected_date' ? (
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
                          className="w-full px-1 py-0.5 border border-blue-500 rounded text-xs"
                        />
                      ) : (
                        formatFullDate(purchase.expected_date)
                      )}
                    </td>

                    {/* 입고여부 */}
                    <td
                      className="px-2 py-1 text-center border-r border-slate-400 cursor-pointer text-[11px] font-bold"
                      style={
                        editingCell?.purchaseId === purchase.id && editingCell?.field === 'received_status'
                          ? {}
                          : purchase.received_status === '입고완료'
                          ? { backgroundColor: '#0a53a8', color: '#ffffff' }
                          : purchase.received_status === '부분입고'
                          ? { backgroundColor: '#00ff00', color: '#000000' }
                          : { backgroundColor: '#b21e27', color: '#ffffff' }
                      }
                      onDoubleClick={() => handleCellDoubleClick(purchase.id, 'received_status', purchase.received_status)}>
                      {editingCell?.purchaseId === purchase.id && editingCell?.field === 'received_status' ? (
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
                          <option value="미입고">미입고</option>
                          <option value="입고완료">입고완료</option>
                          <option value="부분입고">부분입고</option>
                        </select>
                      ) : (
                        purchase.received_status
                      )}
                    </td>

                    {/* 합계금액 (그룹의 첫 행에만 표시) */}
                    {isFirstInGroup && (
                      <td rowSpan={groupSize} className="px-2 py-1 text-center text-green-700 font-bold border-r border-slate-300 bg-green-50">
                        {formatAmount(groupTotalAmount, groupCurrency)}
                      </td>
                    )}

                    {/* 송금현황 (%) - 그룹의 첫 행에만 표시 */}
                    {isFirstInGroup && (
                      <td
                        rowSpan={groupSize}
                        className="px-2 py-1 text-center border-r border-slate-300"
                        style={getPaymentStatusStyle((() => {
                          if (groupTotalAmount === 0) return 0
                          const totalPaid = (purchase.payment_amount1 || 0) + (purchase.payment_amount2 || 0)
                          return (totalPaid / groupTotalAmount * 100).toFixed(0)
                        })())}>
                        <span className="text-[12px] font-bold">
                          {(() => {
                            if (groupTotalAmount === 0) return 0
                            const totalPaid = (purchase.payment_amount1 || 0) + (purchase.payment_amount2 || 0)
                            return (totalPaid / groupTotalAmount * 100).toFixed(0)
                          })()}%
                        </span>
                      </td>
                    )}

                    {/* 송금일1 - 그룹의 첫 행에만 표시 */}
                    {isFirstInGroup && (
                      <td
                        rowSpan={groupSize}
                        className="px-2 py-1 text-center text-slate-600 border-r border-slate-300 cursor-pointer hover:bg-blue-50"
                        onDoubleClick={() => handleCellDoubleClick(purchase.id, 'payment_date1', purchase.payment_date1)}>
                        {editingCell?.purchaseId === purchase.id && editingCell?.field === 'payment_date1' ? (
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
                            className="w-full px-1 py-0.5 border border-blue-500 rounded text-xs"
                          />
                        ) : (
                          formatFullDate(purchase.payment_date1)
                        )}
                      </td>
                    )}

                    {/* 송금액1 - 그룹의 첫 행에만 표시 */}
                    {isFirstInGroup && (
                      <td
                        rowSpan={groupSize}
                        className="px-2 py-1 text-center text-slate-700 border-r border-slate-300 cursor-pointer hover:bg-blue-50"
                        onDoubleClick={() => handleCellDoubleClick(purchase.id, 'payment_amount1', purchase.payment_amount1)}>
                        {editingCell?.purchaseId === purchase.id && editingCell?.field === 'payment_amount1' ? (
                          <input
                            type="number"
                            step="0.01"
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
                          formatAmount(purchase.payment_amount1, purchase.currency)
                        )}
                      </td>
                    )}

                    {/* 환율1 - 그룹의 첫 행에만 표시 */}
                    {isFirstInGroup && (
                      <td
                        rowSpan={groupSize}
                        className="px-2 py-1 text-center text-slate-600 border-r border-slate-300 cursor-pointer hover:bg-blue-50"
                        onDoubleClick={() => handleCellDoubleClick(purchase.id, 'exchange_rate1', purchase.exchange_rate1)}>
                        {editingCell?.purchaseId === purchase.id && editingCell?.field === 'exchange_rate1' ? (
                          <input
                            type="number"
                            step="0.01"
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
                          purchase.exchange_rate1 || '-'
                        )}
                      </td>
                    )}

                    {/* 송금일2 - 그룹의 첫 행에만 표시 */}
                    {isFirstInGroup && (
                      <td
                        rowSpan={groupSize}
                        className="px-2 py-1 text-center text-slate-600 border-r border-slate-300 cursor-pointer hover:bg-blue-50"
                        onDoubleClick={() => handleCellDoubleClick(purchase.id, 'payment_date2', purchase.payment_date2)}>
                        {editingCell?.purchaseId === purchase.id && editingCell?.field === 'payment_date2' ? (
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
                            className="w-full px-1 py-0.5 border border-blue-500 rounded text-xs"
                          />
                        ) : (
                          formatFullDate(purchase.payment_date2)
                        )}
                      </td>
                    )}

                    {/* 송금액2 - 그룹의 첫 행에만 표시 */}
                    {isFirstInGroup && (
                      <td
                        rowSpan={groupSize}
                        className="px-2 py-1 text-center text-slate-700 border-r border-slate-300 cursor-pointer hover:bg-blue-50"
                        onDoubleClick={() => handleCellDoubleClick(purchase.id, 'payment_amount2', purchase.payment_amount2)}>
                        {editingCell?.purchaseId === purchase.id && editingCell?.field === 'payment_amount2' ? (
                          <input
                            type="number"
                            step="0.01"
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
                          formatAmount(purchase.payment_amount2, purchase.currency)
                        )}
                      </td>
                    )}

                    {/* 환율2 - 그룹의 첫 행에만 표시 */}
                    {isFirstInGroup && (
                      <td
                        rowSpan={groupSize}
                        className="px-2 py-1 text-center text-slate-600 border-r border-slate-300 cursor-pointer hover:bg-blue-50"
                        onDoubleClick={() => handleCellDoubleClick(purchase.id, 'exchange_rate2', purchase.exchange_rate2)}>
                        {editingCell?.purchaseId === purchase.id && editingCell?.field === 'exchange_rate2' ? (
                          <input
                            type="number"
                            step="0.01"
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
                          purchase.exchange_rate2 || '-'
                        )}
                      </td>
                    )}

                    {/* 평균환율 - 그룹의 첫 행에만 표시 */}
                    {isFirstInGroup && (
                      <td rowSpan={groupSize} className="px-2 py-1 text-center text-green-700 font-medium">
                        {calculateAvgExchangeRate(purchase)}
                      </td>
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
          className="fixed bottom-6 right-6 w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 flex items-center justify-center z-50 transition-all"
          title="맨 위로"
        >
          <ChevronUp size={24} />
        </button>
      )}

      <div className="text-xs text-slate-500 text-right">
        총 {filteredPurchases.length}건
      </div>

      {/* 매입 수정 모달 */}
      {editingPurchase && (
        <PurchaseModal
          purchase={editingPurchase}
          onSave={handleSavePurchase}
          onClose={() => setEditingPurchase(null)}
        />
      )}

    </div>
  )
}
