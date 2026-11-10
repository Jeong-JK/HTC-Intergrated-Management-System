import { useState } from 'react'
import { X } from 'lucide-react'

export default function PurchaseItemSelectModal({ items, onSelect, onClose }) {
  const [selectedItems, setSelectedItems] = useState([])

  const toggleItem = (index) => {
    if (selectedItems.includes(index)) {
      setSelectedItems(selectedItems.filter(i => i !== index))
    } else {
      setSelectedItems([...selectedItems, index])
    }
  }

  const toggleAll = () => {
    if (selectedItems.length === items.length) {
      setSelectedItems([])
    } else {
      setSelectedItems(items.map((_, idx) => idx))
    }
  }

  const handleConfirm = () => {
    const selected = selectedItems.map(idx => items[idx])
    onSelect(selected)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-blue-50">
          <h2 className="text-xl font-bold text-slate-800">품목 선택</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-slate-600">
              총 <strong>{items.length}개</strong> 품목 중 <strong>{selectedItems.length}개</strong> 선택
            </p>
            <button
              type="button"
              onClick={toggleAll}
              className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50">
              {selectedItems.length === items.length ? '전체 해제' : '전체 선택'}
            </button>
          </div>

          <div className="space-y-2">
            {items.map((item, idx) => (
              <div
                key={idx}
                onClick={() => toggleItem(idx)}
                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedItems.includes(idx)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-300 hover:bg-slate-50'
                }`}>
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedItems.includes(idx)}
                    onChange={() => toggleItem(idx)}
                    className="mt-1 w-4 h-4"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-semibold text-slate-800">{item.product_name}</span>
                      <span className="text-xs px-2 py-0.5 bg-slate-200 text-slate-700 rounded">
                        {item.supplier}
                      </span>
                      {item.project && (
                        <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded font-medium">
                          {item.project}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-slate-600 space-x-4">
                      <span>수량: {item.quantity}개</span>
                      <span>단가: {item.currency === 'KRW' ? '₩' : '$'}{item.net_price?.toLocaleString() || 0}</span>
                      <span className="font-medium">
                        합계: {item.currency === 'KRW' ? '₩' : '$'}{((item.quantity || 0) * (item.net_price || 0)).toLocaleString()}
                      </span>
                      {item.received_status && (
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          item.received_status === '입고완료'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {item.received_status}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-100">
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={selectedItems.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
            {selectedItems.length}개 품목 추가
          </button>
        </div>
      </div>
    </div>
  )
}
