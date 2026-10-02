import { useState, useEffect } from 'react'
import { X, Plus, Trash2, Search, ChevronUp, ChevronDown } from 'lucide-react'
import Combobox from './Combobox'
import PurchaseItemSelectModal from './PurchaseItemSelectModal'
import { getPurchasesByPONumber } from '../api'

// 공급사 옵션
const SUPPLIER_OPTIONS = ['Silvus', 'SWA', '한림', 'Octane', '퓨리원', '국제전파', 'Bren-Tronics']

// 상태 옵션
const STATUS_OPTIONS = ['진행중', '완료', '납기체크', '수금필요']

// 상태 텍스트 포맷팅
const formatStatusForDisplay = (status) => {
  if (status === '납기체크') return '납기체크'
  if (status === '수금필요') return '수금필요'
  return status
}

export default function ProjectModal({ project, onSave, onClose }) {
  const [formData, setFormData] = useState({
    year: 2026,
    project_no: '',
    customer: '',
    project_name: '',
    supplier: '',
    delivery_date: '',
    order_amount: 0,
    status: '진행중',
    notes: '',
    payments: [],
    sales_items: [],
    purchase_items: []
  })

  // 품목 선택 모달
  const [selectModal, setSelectModal] = useState({ show: false, items: [], currentIndex: null })

  useEffect(() => {
    if (project?.id) {
      // 기존 프로젝트 수정 모드
      setFormData({
        ...project,
        payments: project.payments || [],
        sales_items: project.sales_items || [],
        purchase_items: project.purchase_items || []
      })
    } else if (project) {
      // 신규 추가 모드 (year만 설정된 객체)
      setFormData({
        year: project.year || 2026,
        project_no: '',
        customer: '',
        project_name: '',
        supplier: '',
        delivery_date: '',
        order_amount: 0,
        status: '진행중',
        notes: '',
        payments: [],
        sales_items: [],
        purchase_items: []
      })
    }
  }, [project])

  const handleSubmit = (e) => {
    e?.preventDefault()

    // Clean up data: convert empty strings to null for date fields and filter empty items
    const cleanedData = {
      ...formData,
      order_amount: Number(formData.order_amount) || 0,
      delivery_date: formData.delivery_date || null,
      payments: formData.payments
        .filter(p => p.payment_date || p.payment_amount)
        .map(p => ({
          payment_date: p.payment_date || null,
          payment_amount: Number(p.payment_amount) || 0
        })),
      sales_items: formData.sales_items
        .filter(item => item.product_name?.trim() || item.is_empty) // 빈 행도 유지
        .map(item => ({
          product_name: item.is_empty ? '-' : item.product_name,  // 빈 행은 "-"로 저장
          quantity: Number(item.quantity) || 0,
          unit_price: Number(item.unit_price) || 0,
          total_price: Number(item.total_price) || 0
        })),
      purchase_items: formData.purchase_items
        .filter(item => (item.product_name?.trim() && item.supplier?.trim()) || item.is_empty) // 빈 행도 유지
        .map(item => ({
          po_number: item.po_number || null,
          supplier: item.is_empty ? '-' : item.supplier,
          product_name: item.is_empty ? '-' : item.product_name,
          quantity: Number(item.quantity) || 0,
          unit_price_usd: Number(item.unit_price_usd) || 0,
          unit_price_krw: Number(item.unit_price_krw) || 0,
          total_price_usd: Number(item.total_price_usd) || 0,
          total_price_krw: Number(item.total_price_krw) || 0,
          expected_date: item.expected_date || null,
          received_status: item.is_empty ? '-' : (item.received_status || '미입고'),
          payment_status: item.payment_status != null ? Number(item.payment_status) : null,
          exchange_rate: item.exchange_rate != null ? Number(item.exchange_rate) : null,
          actual_order_date: item.actual_order_date || null
        }))
    }

    onSave(cleanedData)
  }

  const addSalesItem = () => {
    setFormData({
      ...formData,
      sales_items: [...formData.sales_items, { product_name: '', quantity: 1, unit_price: 0, total_price: 0 }]
    })
  }

  const removeSalesItem = (index) => {
    setFormData({
      ...formData,
      sales_items: formData.sales_items.filter((_, i) => i !== index)
    })
  }

  const updateSalesItem = (index, field, value) => {
    const updated = [...formData.sales_items]
    updated[index][field] = value
    if (field === 'quantity' || field === 'unit_price') {
      updated[index].total_price = updated[index].quantity * updated[index].unit_price
    }
    setFormData({ ...formData, sales_items: updated })
  }

  const moveSalesItem = (index, direction) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= formData.sales_items.length) return
    const updated = [...formData.sales_items]
    const temp = updated[index]
    updated[index] = updated[newIndex]
    updated[newIndex] = temp
    setFormData({ ...formData, sales_items: updated })
  }

  const addPurchaseItem = () => {
    setFormData({
      ...formData,
      purchase_items: [...formData.purchase_items, {
        po_number: '',
        supplier: '',
        product_name: '',
        quantity: 1,
        unit_price_usd: 0,
        unit_price_krw: 0,
        total_price_usd: 0,
        total_price_krw: 0,
        expected_date: null,
        received_status: '미입고',
        payment_status: null,
        exchange_rate: 1300,
        actual_order_date: null
      }]
    })
  }

  const removePurchaseItem = (index) => {
    setFormData({
      ...formData,
      purchase_items: formData.purchase_items.filter((_, i) => i !== index)
    })
  }

  const movePurchaseItem = (index, direction) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= formData.purchase_items.length) return
    const updated = [...formData.purchase_items]
    const temp = updated[index]
    updated[index] = updated[newIndex]
    updated[newIndex] = temp
    setFormData({ ...formData, purchase_items: updated })
  }

  const updatePurchaseItem = (index, field, value) => {
    const updated = [...formData.purchase_items]
    updated[index][field] = value

    // 자동 계산
    if (field === 'quantity' || field === 'unit_price_usd' || field === 'exchange_rate') {
      const qty = parseFloat(updated[index].quantity) || 0
      const priceUsd = parseFloat(updated[index].unit_price_usd) || 0
      const rate = parseFloat(updated[index].exchange_rate) || 1300

      updated[index].unit_price_krw = priceUsd * rate
      updated[index].total_price_usd = qty * priceUsd
      updated[index].total_price_krw = qty * priceUsd * rate
    }

    setFormData({ ...formData, purchase_items: updated })
  }

  // 발주서 번호로 매입 데이터 로드 (모달 표시)
  const handleLoadPurchaseByPO = async (index) => {
    const poNumber = formData.purchase_items[index]?.po_number

    if (!poNumber || !poNumber.trim()) {
      alert('발주서 번호를 입력하세요')
      return
    }

    try {
      const res = await getPurchasesByPONumber(poNumber.trim(), formData.year)
      const purchases = res.data

      // 응답이 배열인지 확인
      if (!Array.isArray(purchases)) {
        alert(`API 응답 형식 오류\n응답: ${JSON.stringify(purchases)}`)
        return
      }

      if (purchases.length === 0) {
        alert(`발주서 "${poNumber}"를 매입관리에서 찾을 수 없습니다.\n\n먼저 매입관리에서 해당 발주서를 등록해주세요.`)
        return
      }

      // 품목 선택 모달 표시
      setSelectModal({ show: true, items: purchases, currentIndex: index })
    } catch (error) {
      console.error('발주서 로드 실패:', error)
      const errorMsg = error.response?.data?.detail || error.message
      alert(`발주서를 불러오는데 실패했습니다.\n\n오류: ${errorMsg}`)
    }
  }

  // 품목 선택 완료
  const handleSelectPurchaseItems = (selectedItems) => {
    const currentIndex = selectModal.currentIndex
    const poNumber = formData.purchase_items[currentIndex]?.po_number?.trim()

    // 현재 행 제거
    const otherItems = formData.purchase_items.filter((_, idx) => idx !== currentIndex)

    // 선택한 품목들로 새로운 행 생성
    const newItems = selectedItems.map(p => {
      const quantity = p.quantity || 1
      const netPrice = p.net_price || 0
      const currency = p.currency || 'USD'

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
        exchangeRate = p.exchange_rate1 || p.exchange_rate2 || p.po_exchange_rate || null
        unitPriceUsd = netPrice
        totalPriceUsd = netPrice * quantity
        unitPriceKrw = 0  // 단가(원화)는 비움
        totalPriceKrw = exchangeRate ? totalPriceUsd * exchangeRate : 0  // 총금액(원화) = 총금액($) × 환율
      }

      return {
        po_number: poNumber,
        supplier: p.supplier || '',
        product_name: p.product_name || '',
        quantity: quantity,
        unit_price_usd: unitPriceUsd,
        unit_price_krw: unitPriceKrw,
        total_price_usd: totalPriceUsd,
        total_price_krw: totalPriceKrw,
        expected_date: p.expected_date || null,
        received_status: p.received_status || '미입고',
        payment_status: null,
        exchange_rate: exchangeRate,
        actual_order_date: null
      }
    })

    setFormData({ ...formData, purchase_items: [...otherItems, ...newItems] })
  }

  const addPayment = () => {
    setFormData({
      ...formData,
      payments: [...formData.payments, { payment_date: null, payment_amount: 0 }]
    })
  }

  const removePayment = (index) => {
    setFormData({
      ...formData,
      payments: formData.payments.filter((_, i) => i !== index)
    })
  }

  const updatePayment = (index, field, value) => {
    const updated = [...formData.payments]
    updated[index][field] = value
    setFormData({ ...formData, payments: updated })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-[1600px] max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-green-50">
          <h2 className="text-xl font-bold text-slate-800">
            {project?.id ? '프로젝트 수정' : '프로젝트 추가'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* 기본 정보 */}
            <div className="bg-slate-50 p-4 rounded-lg">
              <h3 className="font-semibold text-slate-700 mb-3">기본 정보</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">프로젝트 번호 *</label>
                  <input
                    type="text"
                    required
                    value={formData.project_no}
                    onChange={(e) => setFormData({ ...formData, project_no: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">거래처 *</label>
                  <input
                    type="text"
                    required
                    value={formData.customer}
                    onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">프로젝트명 *</label>
                  <input
                    type="text"
                    required
                    value={formData.project_name}
                    onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">납기요청일</label>
                  <input
                    type="text"
                    placeholder="YY.MM.DD 또는 텍스트"
                    value={formData.delivery_date || ''}
                    onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">수주금액</label>
                  <input
                    type="number"
                    value={formData.order_amount}
                    onChange={(e) => setFormData({ ...formData, order_amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">상태</label>
                  <Combobox
                    value={formData.status}
                    onChange={(value) => setFormData({ ...formData, status: value })}
                    options={STATUS_OPTIONS}
                    placeholder="상태 선택"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">연도</label>
                  <input
                    type="number"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || 2026 })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">비고</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
            </div>

            {/* 수금 정보 */}
            <div className="bg-emerald-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-emerald-700">수금 정보</h3>
                <button
                  type="button"
                  onClick={addPayment}
                  className="flex items-center gap-1 px-3 py-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">
                  <Plus size={16} /> 추가
                </button>
              </div>
              {formData.payments.length === 0 ? (
                <div className="text-sm text-slate-500 text-center py-2">수금 정보가 없습니다. 추가 버튼을 눌러 입력하세요.</div>
              ) : (
                formData.payments.map((payment, idx) => (
                  <div key={idx} className="flex gap-3 mb-2 items-center bg-white p-2 rounded">
                    <div className="flex-1">
                      <label className="block text-xs text-slate-500 mb-1">수금일</label>
                      <input
                        type="text"
                        placeholder="YY.MM.DD"
                        value={payment.payment_date || ''}
                        onChange={(e) => updatePayment(idx, 'payment_date', e.target.value)}
                        className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-slate-500 mb-1">수금액</label>
                      <input
                        type="number"
                        placeholder="금액 입력"
                        value={payment.payment_amount || ''}
                        onChange={(e) => updatePayment(idx, 'payment_amount', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removePayment(idx)}
                      style={{
                        backgroundColor: '#ef4444',
                        color: '#ffffff',
                        padding: '0.5rem',
                        borderRadius: '0.25rem',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginTop: '1.25rem'
                      }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* 판매 품목 & 매입 품목 - 가로 배치 */}
            <div className="flex gap-4">
              {/* 판매 품목 */}
              <div className="flex-1 bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-blue-700">판매 품목</h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={addSalesItem}
                      className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                      <Plus size={16} /> 추가
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({
                        ...formData,
                        sales_items: [...formData.sales_items, { product_name: '', quantity: 0, unit_price: 0, total_price: 0, is_empty: true }]
                      })}
                      className="flex items-center gap-1 px-3 py-1 bg-slate-400 text-white rounded-lg hover:bg-slate-500 text-sm">
                      빈 행
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {formData.sales_items.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center bg-white p-2 rounded">
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => moveSalesItem(idx, -1)}
                          disabled={idx === 0}
                          className="p-0.5 bg-slate-200 rounded hover:bg-slate-300 disabled:opacity-30 disabled:cursor-not-allowed">
                          <ChevronUp size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSalesItem(idx, 1)}
                          disabled={idx === formData.sales_items.length - 1}
                          className="p-0.5 bg-slate-200 rounded hover:bg-slate-300 disabled:opacity-30 disabled:cursor-not-allowed">
                          <ChevronDown size={12} />
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="품목명 입력"
                        value={item.product_name}
                        onChange={(e) => updateSalesItem(idx, 'product_name', e.target.value)}
                        className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm"
                      />
                      <input
                        type="number"
                        placeholder="수량"
                        value={item.quantity === 0 ? '' : item.quantity}
                        onChange={(e) => updateSalesItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-16 px-2 py-1 border border-slate-300 rounded text-sm"
                      />
                      <input
                        type="number"
                        placeholder="단가(원)"
                        value={item.unit_price === 0 ? '' : item.unit_price}
                        onChange={(e) => updateSalesItem(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                        className="w-24 px-2 py-1 border border-slate-300 rounded text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeSalesItem(idx)}
                        style={{
                          backgroundColor: '#ef4444',
                          color: '#ffffff',
                          padding: '0.25rem',
                          borderRadius: '0.25rem',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* 매입 품목 */}
              <div className="flex-1 bg-orange-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-orange-700">매입 품목</h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={addPurchaseItem}
                      className="flex items-center gap-1 px-3 py-1 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm">
                      <Plus size={16} /> 추가
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({
                        ...formData,
                        purchase_items: [...formData.purchase_items, {
                          po_number: '', supplier: '-', product_name: '-', quantity: 0,
                          unit_price_usd: 0, unit_price_krw: 0, total_price_usd: 0, total_price_krw: 0,
                          expected_date: null, received_status: '-', payment_status: null,
                          exchange_rate: null, actual_order_date: null, is_empty: true
                        }]
                      })}
                      className="flex items-center gap-1 px-3 py-1 bg-slate-400 text-white rounded-lg hover:bg-slate-500 text-sm">
                      빈 행
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {formData.purchase_items.map((item, idx) => (
                    <div key={idx} className="mb-2">
                      <div className="flex gap-2 items-center bg-white p-2 rounded text-sm">
                        <div className="flex flex-col gap-0.5">
                          <button
                            type="button"
                            onClick={() => movePurchaseItem(idx, -1)}
                            disabled={idx === 0}
                            className="p-0.5 bg-slate-200 rounded hover:bg-slate-300 disabled:opacity-30 disabled:cursor-not-allowed">
                            <ChevronUp size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => movePurchaseItem(idx, 1)}
                            disabled={idx === formData.purchase_items.length - 1}
                            className="p-0.5 bg-slate-200 rounded hover:bg-slate-300 disabled:opacity-30 disabled:cursor-not-allowed">
                            <ChevronDown size={12} />
                          </button>
                        </div>
                        <Combobox
                          value={item.supplier}
                          onChange={(value) => updatePurchaseItem(idx, 'supplier', value)}
                          options={SUPPLIER_OPTIONS}
                          placeholder="공급사 선택"
                          className="text-sm"
                        />
                        <div className="flex gap-1 min-w-0">
                          <input
                            type="text"
                            placeholder="발주서 번호"
                            value={item.po_number}
                            onChange={(e) => updatePurchaseItem(idx, 'po_number', e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleLoadPurchaseByPO(idx)}
                            className="px-2 py-1 border border-slate-300 rounded text-sm flex-1 min-w-0"
                          />
                          <button
                            type="button"
                            onClick={() => handleLoadPurchaseByPO(idx)}
                            className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 flex-shrink-0"
                            title="매입에서 불러오기">
                            <Search size={14} />
                          </button>
                        </div>
                        <input
                          type="text"
                          placeholder="매입품목명"
                          value={item.product_name}
                          readOnly
                          onClick={() => alert('발주서 번호를 입력 후 검색 버튼을 눌러주세요')}
                          className="px-2 py-1 border border-slate-300 rounded text-sm flex-1 cursor-not-allowed"
                        />
                        <input
                          type="number"
                          placeholder="수량"
                          value={item.quantity === 0 ? '' : item.quantity}
                          onChange={(e) => updatePurchaseItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                          className="w-16 px-2 py-1 border border-slate-300 rounded text-sm"
                        />
                        <input
                          type="number"
                          placeholder="단가($)"
                          value={item.unit_price_usd === 0 ? '' : item.unit_price_usd}
                          onChange={(e) => updatePurchaseItem(idx, 'unit_price_usd', parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 border border-slate-300 rounded text-sm"
                        />
                        <input
                          type="text"
                          placeholder="YY.MM.DD"
                          value={item.actual_order_date || ''}
                          onChange={(e) => updatePurchaseItem(idx, 'actual_order_date', e.target.value)}
                          className="w-20 px-2 py-1 border border-slate-300 rounded text-sm"
                          title="배송비 절감을 위해 다른 연도 물품과 함께 발주한 경우"
                        />
                        <button
                          type="button"
                          onClick={() => removePurchaseItem(idx)}
                          style={{
                            backgroundColor: '#ef4444',
                            color: '#ffffff',
                            padding: '0.25rem',
                            borderRadius: '0.25rem',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 스크롤 여백 (하단 플로팅 바 공간 확보) */}
          <div className="h-20"></div>
        </form>

        {/* 하단 플로팅 액션바 */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-slate-800 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-4">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-1.5 bg-slate-600 hover:bg-slate-500 rounded-full text-sm font-medium transition-colors">
              취소
            </button>
            <div className="w-px h-5 bg-slate-600"/>
            <button
              type="button"
              onClick={handleSubmit}
              className="px-5 py-1.5 bg-green-500 hover:bg-green-600 rounded-full text-sm font-medium transition-colors">
              저장
            </button>
          </div>
        </div>

        {/* 품목 선택 모달 */}
        {selectModal.show && (
          <PurchaseItemSelectModal
            items={selectModal.items}
            onSelect={handleSelectPurchaseItems}
            onClose={() => setSelectModal({ show: false, items: [], currentIndex: null })}
          />
        )}
      </div>
    </div>
  )
}
