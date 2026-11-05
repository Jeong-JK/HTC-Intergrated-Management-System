import { useState, useEffect } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import Combobox from './Combobox'
import { getPurchasesByPONumber, createPurchase, updatePurchase, deletePurchase, getProjects } from '../api'
import { parseDate, SUPPLIER_OPTIONS, RECEIVED_STATUS_OPTIONS } from '../utils/projectCommon'

export default function PurchaseModal({ purchase, onSave, onClose }) {
  const [commonData, setCommonData] = useState({
    po_number: '',
    quote: '',
    oc: '',
    invoice: '',
    request_number: '',
    expected_date: ''
  })

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedItems, setSelectedItems] = useState([])
  const [projectOptions, setProjectOptions] = useState([]) // 프로젝트 드롭다운 옵션

  // 프로젝트 목록 로드
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const res = await getProjects({ year: purchase?.year || 2026 })
        // "고객사_프로젝트명" 형식으로 옵션 생성
        const options = res.data.map(p => `${p.customer}_${p.project_name}`)
        setProjectOptions(['프로젝트 미정', ...options])
      } catch (error) {
        console.error('프로젝트 목록 로드 실패:', error)
        setProjectOptions(['프로젝트 미정'])
      }
    }
    loadProjects()
  }, [purchase?.year])

  // 같은 PO 번호의 모든 품목 조회 (기존) 또는 신규 모드 초기화
  useEffect(() => {
    const loadPOItems = async () => {
      // 신규 추가 모드 (purchase가 없거나 po_number가 없음)
      if (!purchase || !purchase.po_number) {
        setCommonData({
          po_number: '',
          quote: '',
          oc: '',
          invoice: '',
          request_number: '',
          expected_date: ''
        })
        setItems([{
          // id 없음 = 신규
          supplier: '',
          project: '',
          product_name: '',
          quantity: 1,
          net_price: 0,
          currency: 'USD',
          received_status: '미입고'
        }])
        setLoading(false)
        return
      }

      // 기존 수정 모드
      try {
        setLoading(true)
        const res = await getPurchasesByPONumber(purchase.po_number, purchase.year)

        // 응답이 배열인지 확인 (백엔드가 배열을 직접 반환함)
        const items = Array.isArray(res.data) ? res.data : (res.data?.items || [])

        // 공통 정보 설정 (첫 번째 항목 기준)
        if (items.length > 0) {
          const first = items[0]
          setCommonData({
            po_number: first.po_number,
            quote: first.quote || '',
            oc: first.oc || '',
            invoice: first.invoice || '',
            request_number: first.request_number || '',
            expected_date: first.expected_date || ''
          })
        }

        // 품목 리스트 설정 (송금 정보는 테이블에서 더블클릭으로 수정)
        setItems(items.map(p => ({
          id: p.id, // 기존 항목은 id 있음
          supplier: p.supplier || '',
          project: p.project || '',
          product_name: p.product_name,
          quantity: p.quantity || 1,
          net_price: p.net_price || 0,
          currency: p.currency || 'USD',
          received_status: p.received_status || '미입고'
        })))
      } catch (error) {
        console.error('품목 조회 실패:', error)
        console.error('에러 상세:', error.response?.data, error.message)
        const detail = error.response?.data?.detail
        const errMsg = typeof detail === 'object' ? JSON.stringify(detail) : (detail || error.message || '알 수 없는 오류')
        alert(`품목 조회에 실패했습니다.\n${errMsg}`)
      } finally {
        setLoading(false)
      }
    }

    loadPOItems()
  }, [purchase])

  const addItem = () => {
    setItems([...items, {
      // id 없음 = 새로운 품목 (송금 정보는 테이블에서 더블클릭으로 수정)
      supplier: '',
      project: '',
      product_name: '',
      quantity: 1,
      net_price: 0,
      currency: 'USD',
      received_status: '미입고'
    }])
  }

  const addShipping = () => {
    // 첫 번째 품목의 공급사만 가져옴 (프로젝트는 빈칸)
    const supplier = items.length > 0 ? items[0].supplier : ''
    setItems([...items, {
      supplier: supplier,
      project: '',
      product_name: 'Shipping and Handling',
      quantity: 1,
      net_price: 0,
      currency: 'USD',
      received_status: '입고완료'
    }])
  }

  const removeItem = (index) => {
    if (items.length === 1) {
      alert('최소 1개의 품목이 필요합니다')
      return
    }
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index, field, value) => {
    const updated = [...items]
    updated[index][field] = value
    setItems(updated)
  }

  // 체크박스 토글
  const toggleItemSelection = (index) => {
    if (selectedItems.includes(index)) {
      setSelectedItems(selectedItems.filter(i => i !== index))
    } else {
      setSelectedItems([...selectedItems, index])
    }
  }

  // 전체 선택/해제
  const toggleAllSelection = () => {
    if (selectedItems.length === items.length) {
      setSelectedItems([])
    } else {
      setSelectedItems(items.map((_, idx) => idx))
    }
  }

  // 선택된 항목 입고 처리
  const handleBulkReceive = async (status) => {
    if (selectedItems.length === 0) {
      alert('입고 처리할 품목을 선택하세요')
      return
    }

    if (!confirm(`선택한 ${selectedItems.length}개 품목을 "${status}"로 처리하시겠습니까?`)) {
      return
    }

    try {
      // 선택된 품목들 업데이트
      for (const index of selectedItems) {
        const item = items[index]
        if (item.id) {
          await updatePurchase(item.id, { received_status: status })
        }
      }

      // 상태 업데이트
      const updated = [...items]
      selectedItems.forEach(index => {
        updated[index].received_status = status
      })
      setItems(updated)
      setSelectedItems([])

      alert(`${selectedItems.length}개 품목의 입고 상태가 변경되었습니다`)
    } catch (error) {
      console.error('입고 처리 실패:', error)
      alert('입고 처리에 실패했습니다')
    }
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()

    // 품목명 검증
    const validItems = items.filter(item => item.product_name?.trim() && item.supplier?.trim())
    if (validItems.length === 0) {
      alert('최소 하나의 품목을 입력해주세요 (품목명, 공급사 필수)')
      return
    }

    setSaving(true)
    try {
      const isNewMode = !purchase || !purchase.po_number

      // 기존 수정 모드일 때만 삭제 처리
      if (!isNewMode) {
        // 기존에 있던 ID 목록
        const originalIds = new Set(
          (await getPurchasesByPONumber(commonData.po_number, purchase.year)).data.map(p => p.id)
        )

        // 현재 남아있는 품목의 ID 목록
        const currentIds = new Set(validItems.filter(item => item.id).map(item => item.id))

        // 삭제된 품목 처리
        for (const id of originalIds) {
          if (!currentIds.has(id)) {
            await deletePurchase(id)
          }
        }
      }

      // 각 품목 처리 (송금 정보는 테이블에서 더블클릭으로 수정하므로 여기서는 제외)
      for (const item of validItems) {
        const itemData = {
          year: purchase?.year || 2026,
          po_number: commonData.po_number?.trim() || null,
          quote: commonData.quote?.trim() || null,
          oc: commonData.oc?.trim() || null,
          invoice: commonData.invoice?.trim() || null,
          request_number: commonData.request_number?.trim() || null,
          expected_date: commonData.expected_date?.trim() ? parseDate(commonData.expected_date) : null,
          supplier: item.supplier,
          project: item.project?.trim() || null,
          product_name: item.product_name,
          quantity: item.quantity,
          net_price: item.net_price,
          currency: item.currency,
          received_status: item.received_status,
          amount: item.quantity * item.net_price
        }

        if (item.id) {
          // 기존 품목 수정 (송금 정보는 건드리지 않음)
          await updatePurchase(item.id, itemData)
        } else {
          // 새로운 품목 생성
          await createPurchase(itemData)
        }
      }

      alert(isNewMode ? '매입이 추가되었습니다' : '매입이 수정되었습니다')
      onClose()
      if (onSave) onSave(null) // 리로드 요청
    } catch (error) {
      console.error('저장 실패:', error)
      const detail = error.response?.data?.detail
      const msg = typeof detail === 'object' ? JSON.stringify(detail) : (detail || error.message || '저장에 실패했습니다')
      alert(msg)
    } finally {
      setSaving(false)
    }
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

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <p className="text-slate-600">로딩 중...</p>
        </div>
      </div>
    )
  }

  const isNewMode = !purchase || !purchase.po_number

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-blue-50">
          <h2 className="text-xl font-bold text-slate-800">
            {isNewMode ? '매입 추가' : `매입 수정 - PO: ${commonData.po_number}`}
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
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">PO 번호</label>
                  <input
                    type="text"
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">입고예정일</label>
                  <input
                    type="text"
                    placeholder="YY.MM.DD / YYMMDD / 26.2.6 등"
                    value={commonData.expected_date}
                    onChange={(e) => setCommonData({ ...commonData, expected_date: e.target.value })}
                    onBlur={(e) => setCommonData({ ...commonData, expected_date: parseDate(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* 품목 리스트 */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-blue-700">품목 목록</h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={addItem}
                    className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                    <Plus size={16} /> 품목 추가
                  </button>
                  <button
                    type="button"
                    onClick={addShipping}
                    className="flex items-center gap-1 px-3 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm">
                    <Plus size={16} /> 배송비
                  </button>
                </div>
              </div>

              {/* 입고 처리 버튼 */}
              {items.length > 0 && (
                <div className="flex items-center gap-2 mb-3 p-2 bg-white rounded-lg">
                  <input
                    type="checkbox"
                    checked={selectedItems.length === items.length && items.length > 0}
                    onChange={toggleAllSelection}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-slate-700 mr-2">
                    {selectedItems.length}개 선택
                  </span>
                  {selectedItems.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleBulkReceive('입고완료')}
                        className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700">
                        입고완료
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBulkReceive('부분입고')}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
                        부분입고
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBulkReceive('미입고')}
                        className="px-3 py-1 bg-orange-600 text-white rounded text-sm hover:bg-orange-700">
                        미입고
                      </button>
                    </>
                  )}
                </div>
              )}

              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div key={idx} className="bg-white p-3 rounded-lg space-y-3">
                    {/* 체크박스와 기본 품목 정보 */}
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(idx)}
                        onChange={() => toggleItemSelection(idx)}
                        className="w-4 h-4 mt-6"
                      />
                      <div className="flex-1 space-y-3">
                        {/* 기본 품목 정보 */}
                        <div className="grid grid-cols-11 gap-2 items-end">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">공급사 *</label>
                        <Combobox
                          value={item.supplier}
                          onChange={(value) => updateItem(idx, 'supplier', value)}
                          options={SUPPLIER_OPTIONS}
                          placeholder="공급사"
                          className="text-xs"
                        />
                      </div>
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
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">입고</label>
                        <Combobox
                          value={item.received_status}
                          onChange={(value) => updateItem(idx, 'received_status', value)}
                          options={RECEIVED_STATUS_OPTIONS}
                          placeholder="입고"
                          className="text-sm"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="px-2 py-2 text-red-600 hover:bg-red-50 rounded">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                      </div>
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
              disabled={saving}
              className="px-5 py-1.5 bg-slate-600 hover:bg-slate-500 rounded-full text-sm font-medium transition-colors disabled:opacity-50">
              취소
            </button>
            <div className="w-px h-5 bg-slate-600"/>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="px-5 py-1.5 bg-blue-500 hover:bg-blue-600 rounded-full text-sm font-medium transition-colors disabled:opacity-50">
              {saving ? '저장 중...' : `${items.length}개 품목 저장`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
