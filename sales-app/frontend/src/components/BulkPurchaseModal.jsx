import { useState, useEffect } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import Combobox from './Combobox'
import { getProjects } from '../api'

// 공급사 옵션
const SUPPLIER_OPTIONS = ['Silvus', 'SWA', '한림', 'Octane', '퓨리원', '국제전파', 'Bren-Tronics']

// 입고여부 옵션
const RECEIVED_STATUS_OPTIONS = ['미입고', '입고완료', '부분입고']

export default function BulkPurchaseModal({ year, onSave, onClose }) {
  const [projectOptions, setProjectOptions] = useState(['프로젝트 미정'])

  // 프로젝트 목록 로드
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const res = await getProjects({ year: year || 2026 })
        const options = res.data.map(p => `${p.customer}_${p.project_name}`)
        setProjectOptions(['프로젝트 미정', ...options])
      } catch (error) {
        console.error('프로젝트 목록 로드 실패:', error)
      }
    }
    loadProjects()
  }, [year])

  const [commonData, setCommonData] = useState({
    po_number: '',
    quote: '',
    oc: '',
    invoice: '',
    request_number: '',
    supplier: '',
    expected_date: ''
  })

  const [items, setItems] = useState([
    {
      project: '',
      product_name: '',
      quantity: 1,
      net_price: 0,
      currency: 'USD',
      received_status: '미입고'
    }
  ])

  const addItem = () => {
    // 이전 품목의 프로젝트를 기본값으로 사용
    const lastProject = items.length > 0 ? items[items.length - 1].project : ''
    setItems([...items, {
      project: lastProject,
      product_name: '',
      quantity: 1,
      net_price: 0,
      currency: 'USD',
      received_status: '미입고'
    }])
  }

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index, field, value) => {
    const updated = [...items]
    updated[index][field] = value
    setItems(updated)
  }

  const handleSubmit = (e) => {
    e?.preventDefault()

    // 품목명이 있는 항목만 필터링
    const validItems = items.filter(item => item.product_name?.trim())

    if (validItems.length === 0) {
      alert('최소 하나의 품목을 입력해주세요')
      return
    }

    // 각 품목에 공통 정보를 추가하여 개별 매입 항목으로 생성
    const purchases = validItems.map(item => ({
      year: year || 2026,
      ...commonData,
      project: item.project,
      product_name: item.product_name,
      quantity: item.quantity,
      net_price: item.net_price,
      currency: item.currency,
      received_status: item.received_status,
      expected_date: commonData.expected_date || null,
      amount: item.quantity * item.net_price,
      payment_date1: null,
      payment_amount1: 0,
      exchange_rate1: null,
      payment_date2: null,
      payment_amount2: 0,
      exchange_rate2: null
    }))

    onSave(purchases)
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-blue-50">
          <h2 className="text-xl font-bold text-slate-800">묶음 매입 추가</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* 공통 정보 */}
            <div className="bg-slate-50 p-4 rounded-lg">
              <h3 className="font-semibold text-slate-700 mb-3">공통 정보</h3>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">PO 번호 *</label>
                  <input
                    type="text"
                    required
                    value={commonData.po_number}
                    onChange={(e) => setCommonData({ ...commonData, po_number: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Quote</label>
                  <input
                    type="text"
                    value={commonData.quote}
                    onChange={(e) => setCommonData({ ...commonData, quote: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">OC</label>
                  <input
                    type="text"
                    value={commonData.oc}
                    onChange={(e) => setCommonData({ ...commonData, oc: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Invoice</label>
                  <input
                    type="text"
                    value={commonData.invoice}
                    onChange={(e) => setCommonData({ ...commonData, invoice: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">품의번호</label>
                  <input
                    type="text"
                    value={commonData.request_number}
                    onChange={(e) => setCommonData({ ...commonData, request_number: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">공급사 *</label>
                  <Combobox
                    value={commonData.supplier}
                    onChange={(value) => setCommonData({ ...commonData, supplier: value })}
                    options={SUPPLIER_OPTIONS}
                    placeholder="공급사 선택"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">입고예정일</label>
                  <input
                    type="text"
                    placeholder="YY.MM.DD 또는 텍스트"
                    value={commonData.expected_date}
                    onChange={(e) => setCommonData({ ...commonData, expected_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* 품목 리스트 */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-blue-700">품목 목록</h3>
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                  <Plus size={16} /> 품목 추가
                </button>
              </div>

              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-8 gap-2 items-center bg-white p-3 rounded-lg">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-slate-700 mb-1">프로젝트</label>
                      <Combobox
                        value={item.project}
                        onChange={(value) => updateItem(idx, 'project', value === '프로젝트 미정' ? '' : value)}
                        options={projectOptions}
                        placeholder="프로젝트 선택"
                        className="text-sm"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-slate-700 mb-1">품목명 *</label>
                      <input
                        type="text"
                        placeholder="품목명"
                        value={item.product_name}
                        onChange={(e) => updateItem(idx, 'product_name', e.target.value)}
                        className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">수량</label>
                      <input
                        type="number"
                        placeholder="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">통화</label>
                      <select
                        value={item.currency}
                        onChange={(e) => updateItem(idx, 'currency', e.target.value)}
                        className="w-full px-2 py-1 border border-slate-300 rounded text-sm">
                        <option value="USD">USD</option>
                        <option value="KRW">KRW</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">단가</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0"
                        value={item.net_price}
                        onChange={(e) => updateItem(idx, 'net_price', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">금액</label>
                      <div className="w-full px-2 py-1 bg-slate-100 border border-slate-300 rounded text-sm font-medium text-slate-700">
                        {formatAmount(item.quantity * item.net_price, item.currency)}
                      </div>
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-slate-700 mb-1">입고</label>
                        <Combobox
                          value={item.received_status}
                          onChange={(value) => updateItem(idx, 'received_status', value)}
                          options={RECEIVED_STATUS_OPTIONS}
                          placeholder="입고여부"
                          className="text-xs"
                        />
                      </div>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* 합계 */}
              <div className="mt-4 pt-3 border-t border-blue-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-700">총 품목 수:</span>
                  <span className="text-lg font-bold text-blue-700">{items.length}개</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-sm font-medium text-slate-700">총 금액:</span>
                  <div className="text-lg font-bold text-blue-700">
                    {(() => {
                      const usdTotal = items.filter(i => i.currency === 'USD').reduce((sum, item) => sum + (item.quantity * item.net_price), 0)
                      const krwTotal = items.filter(i => i.currency === 'KRW').reduce((sum, item) => sum + (item.quantity * item.net_price), 0)
                      return (
                        <>
                          {usdTotal > 0 && <span className="mr-3">{formatAmount(usdTotal, 'USD')}</span>}
                          {krwTotal > 0 && <span>{formatAmount(krwTotal, 'KRW')}</span>}
                          {usdTotal === 0 && krwTotal === 0 && <span>$0</span>}
                        </>
                      )
                    })()}
                  </div>
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
              className="px-5 py-1.5 bg-blue-500 hover:bg-blue-600 rounded-full text-sm font-medium transition-colors">
              {items.length}개 품목 일괄 저장
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
