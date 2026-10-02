import { useState, useEffect, useCallback } from 'react'
import { getItems, updateItemsDescription } from '../api.js'
import { PageHeader, Table, Spinner, Empty, Btn, Modal, Field, inputCls } from '../components/Common.jsx'
import { RefreshCw, Search, X } from 'lucide-react'

export default function ProductSpecs() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [editModal, setEditModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [editDesc, setEditDesc] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // 모든 아이템 가져오기
      const res = await getItems({})
      const items = res.data || []

      // 품명별로 중복 제거 (첫 번째 항목의 설명 사용)
      const uniqueMap = new Map()
      items.forEach(item => {
        if (!uniqueMap.has(item.item_name)) {
          uniqueMap.set(item.item_name, {
            item_name: item.item_name,
            description: item.description || '',
            item_type: item.item_type,
            category: item.category
          })
        }
      })

      // 품명 기준 정렬
      const uniqueProducts = Array.from(uniqueMap.values())
        .sort((a, b) => a.item_name.localeCompare(b.item_name, 'ko'))

      setProducts(uniqueProducts)
    } catch (err) {
      console.error('Failed to load products:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = products.filter(p => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      p.item_name.toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      (p.item_type || '').toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q)
    )
  })

  const openEditModal = (product) => {
    setEditItem(product)
    setEditDesc(product.description || '')
    setEditModal(true)
  }

  const handleSaveDesc = async () => {
    if (!editItem) return
    setSaving(true)
    try {
      await updateItemsDescription({
        item_name: editItem.item_name,
        description: editDesc
      })
      setEditModal(false)
      setEditItem(null)
      load()
    } catch (err) {
      alert('저장 실패: ' + (err.response?.data?.detail || err.message))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 min-h-full">
      <PageHeader title="상세정보" sub={`총 ${filtered.length}개 품목`}>
        <Btn onClick={load}><RefreshCw size={14} className={loading ? 'animate-spin' : ''}/></Btn>
      </PageHeader>

      <div className="flex gap-3 mb-4 items-center">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="품명, 설명 검색..."
            className="bg-white border border-slate-200 rounded-lg pl-9 pr-8 py-1.5 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:border-blue-400 w-72"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={14}/>
            </button>
          )}
        </div>
      </div>

      <Table headers={['품명', '설명', '']}>
        {loading && <Spinner/>}
        {!loading && filtered.length === 0 && <Empty/>}
        {!loading && filtered.map((p, idx) => (
          <tr key={p.item_name} className="inv-row border-b border-slate-100"
            style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
            <td className="px-4 py-3 font-medium text-slate-700">{p.item_name}</td>
            <td className="px-4 py-3 text-sm text-slate-600">{p.description || '-'}</td>
            <td className="px-4 py-3">
              <button onClick={() => openEditModal(p)} className="px-2.5 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors whitespace-nowrap">입력</button>
            </td>
          </tr>
        ))}
      </Table>

      {/* 설명 수정 모달 */}
      {editModal && editItem && (
        <Modal
          title={`설명 수정 - ${editItem.item_name}`}
          onClose={() => setEditModal(false)}
          footer={<>
            <Btn onClick={() => setEditModal(false)} className="flex-1 justify-center">취소</Btn>
            <Btn onClick={handleSaveDesc} variant="primary" className="flex-1 justify-center" disabled={saving}>
              {saving ? '저장 중...' : '저장'}
            </Btn>
          </>}
        >
          <Field label="설명">
            <textarea
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              className={`${inputCls} min-h-[100px] resize-y`}
              placeholder="설명을 입력하세요..."
              autoFocus
            />
          </Field>
          <p className="text-xs text-slate-500 mt-2">
            * 이 품명을 가진 모든 재고 아이템의 설명이 함께 변경됩니다.
          </p>
        </Modal>
      )}
    </div>
  )
}
