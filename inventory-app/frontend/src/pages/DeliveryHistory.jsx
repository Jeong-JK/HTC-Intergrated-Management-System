import React, { useState, useEffect, useCallback, useRef } from 'react'
import { getDeliveries, deleteDelivery, confirmDelivery, updateDeliveryGroup, getSalesCompanies } from '../api.js'
import { PageHeader, Table, Spinner, Empty, Btn, Modal, Field, inputCls } from '../components/Common.jsx'
import { RefreshCw, Search, Trash2, CheckCircle, Printer, Edit2, X } from 'lucide-react'
import { usePersistedState } from '../hooks/usePersistedState.js'
import { useScrollRestore } from '../hooks/useScrollRestore.js'
import EditableDeliveryReceipt from '../components/EditableDeliveryReceipt.jsx'
import ScrollToTop from '../components/ScrollToTop.jsx'
import dayjs from 'dayjs'
import { CompanyAutocomplete } from '../components/CompanyAutocomplete.jsx'

const TODAY = dayjs().format('YYYY-MM-DD')

export default function DeliveryHistory() {
  const [deliveries, setDeliveries] = useState([])
  const [allDeliveries, setAllDeliveries] = useState([])
  const [loading, setLoading]       = useState(false)
  const [search, setSearch]         = usePersistedState('delivery_search', '')
  const [showPending, setShowPending] = usePersistedState('delivery_show_pending_v2', true)
  const [showCompleted, setShowCompleted] = usePersistedState('delivery_show_completed_v2', false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [confirmModal, setConfirmModal] = useState(false)
  const [confirmDate, setConfirmDate] = useState('')  // 납품처리 시 날짜
  const [showReceipt, setShowReceipt] = useState(false)
  const [receiptData, setReceiptData] = useState(null)
  const [editGroupModal, setEditGroupModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState(null)
  const [editDeliveryDate, setEditDeliveryDate] = useState('')
  const [editDeliveryUndecided, setEditDeliveryUndecided] = useState(false)
  const [editClient, setEditClient] = useState('')
  const [editProjectName, setEditProjectName] = useState('')
  const [editContactName, setEditContactName] = useState('')
  const [editContactPhone, setEditContactPhone] = useState('')
  const [companies, setCompanies] = useState([])
  const [selectedCompany, setSelectedCompany] = useState(null)

  useScrollRestore('delivery_history', [deliveries])

  useEffect(() => {
    getSalesCompanies().then(r => setCompanies(r.data)).catch(console.error)
  }, [])

  // 납품 데이터를 그룹화하는 함수 (같은 날짜, 업체, 담당자)
  const groupDeliveries = (deliveries) => {
    const groups = {}

    deliveries.forEach(delivery => {
      // 날짜 + 업체 + 프로젝트명 + 담당자로 그룹화 (미정은 null로 저장되므로 자동 그룹화됨)
      const key = `${delivery.delivery_date || 'null'}|${delivery.client}|${delivery.project_name || ''}|${delivery.contact_name || ''}`
      if (!groups[key]) {
        groups[key] = {
          key,
          delivery_date: delivery.delivery_date,
          client: delivery.client,
          contact_name: delivery.contact_name,
          contact_position: delivery.contact_position,
          contact_phone: delivery.contact_phone,
          project_name: delivery.project_name,
          items: []
        }
      }
      groups[key].items.push(delivery)
    })

    return Object.values(groups)
  }

  const load = useCallback(async (preserveScroll = false) => {
    // 스크롤 위치 저장
    const mainContainer = document.querySelector('main')
    const scrollPosition = preserveScroll && mainContainer ? mainContainer.scrollTop : null

    if (!preserveScroll) {
      setLoading(true)
    }

    try {
      const r = await getDeliveries({})
      setAllDeliveries(r.data)

      // 상태 필터링
      let filtered = r.data.filter(item => {
        const isPending = item.status === '납품예정'
        if (isPending) {
          return showPending
        } else {
          return showCompleted
        }
      })

      // 검색어 필터링
      if (search) {
        const query = search.toLowerCase()
        filtered = filtered.filter(item =>
          (item.client && item.client.toLowerCase().includes(query)) ||
          (item.project_name && item.project_name.toLowerCase().includes(query)) ||
          (item.item_name && item.item_name.toLowerCase().includes(query)) ||
          (item.description && item.description.toLowerCase().includes(query)) ||
          (item.serial_ip && item.serial_ip.toLowerCase().includes(query))
        )
      }

      setDeliveries(filtered)

      // 스크롤 위치 복원
      if (scrollPosition !== null && mainContainer) {
        requestAnimationFrame(() => {
          mainContainer.scrollTop = scrollPosition
        })
      }
    } finally {
      if (!preserveScroll) {
        setLoading(false)
      }
    }
  }, [search, showPending, showCompleted])

  useEffect(() => { load() }, [load])

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const toggleSelectAll = () => {
    const pending = deliveries.filter(d => d.status === '납품예정')
    if (selectedIds.size === pending.length && pending.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(pending.map(d => d.id)))
    }
  }

  // 그룹 전체 선택/해제
  const toggleGroupSelect = (group) => {
    const pendingInGroup = group.items.filter(d => d.status === '납품예정')
    const allSelected = pendingInGroup.every(d => selectedIds.has(d.id))

    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (allSelected) {
        // 모두 선택되어 있으면 해제
        pendingInGroup.forEach(d => newSet.delete(d.id))
      } else {
        // 하나라도 선택 안되어 있으면 모두 선택
        pendingInGroup.forEach(d => newSet.add(d.id))
      }
      return newSet
    })
  }

  // 그룹 내 선택 상태 확인
  const getGroupSelectState = (group) => {
    const pendingInGroup = group.items.filter(d => d.status === '납품예정')
    if (pendingInGroup.length === 0) return 'none'

    const selectedCount = pendingInGroup.filter(d => selectedIds.has(d.id)).length
    if (selectedCount === 0) return 'none'
    if (selectedCount === pendingInGroup.length) return 'all'
    return 'partial'
  }

  const openConfirmModal = () => {
    if (selectedIds.size === 0) {
      alert('납품처리할 항목을 선택하세요')
      return
    }
    setConfirmDate(TODAY)  // 기본값 오늘
    setConfirmModal(true)
  }

  const handleConfirm = async () => {
    if (selectedIds.size === 0) {
      alert('납품처리할 항목을 선택하세요')
      return
    }
    if (!confirmDate) {
      alert('납품일을 입력하세요')
      return
    }

    try {
      for (const id of selectedIds) {
        await confirmDelivery(id, { delivery_date: confirmDate })
      }
      setConfirmModal(false)
      setSelectedIds(new Set())
      setConfirmDate('')
      load(true)
    } catch (e) {
      alert(e.response?.data?.detail || '납품처리에 실패했습니다')
    }
  }

  const handleDelete = async (d) => {
    if (!confirm(`납품 기록을 삭제할까요?\n업체: ${d.client}\n품명: ${d.item_name}`)) return
    try {
      await deleteDelivery(d.id)
      load(true)
    } catch (e) {
      alert(e.response?.data?.detail || '삭제에 실패했습니다')
    }
  }

  // 개별 인수증 출력
  const handlePrintReceipt = (d) => {
    setReceiptData({
      delivery_date: d.delivery_date || '',
      client: d.client,
      contact_name: d.contact_name || '',
      contact_position: d.contact_position || '',
      contact_phone: d.contact_phone || '',
      items: [{
        item_name: d.item_name || '',
        description: d.description || '',
        serial_ip: d.serial_ip || '',
        quantity: d.quantity,
        note: d.note || ''
      }]
    })
    setShowReceipt(true)
  }

  // 그룹 인수증 출력
  const handlePrintGroupReceipt = (group) => {
    setReceiptData({
      delivery_date: group.delivery_date || '',
      client: group.client,
      contact_name: group.contact_name || '',
      contact_position: group.contact_position || '',
      contact_phone: group.contact_phone || '',
      items: group.items.map(d => ({
        item_name: d.item_name || '',
        description: d.description || '',
        serial_ip: d.serial_ip || '',
        quantity: d.quantity,
        note: d.note || ''
      }))
    })
    setShowReceipt(true)
  }

  // 선택된 항목들 인수증 출력
  const handlePrintSelectedReceipt = () => {
    if (selectedIds.size === 0) {
      alert('출력할 항목을 선택하세요')
      return
    }

    const selectedDeliveries = deliveries.filter(d => selectedIds.has(d.id))
    if (selectedDeliveries.length === 0) return

    const first = selectedDeliveries[0]
    setReceiptData({
      delivery_date: first.delivery_date || '',
      client: first.client,
      contact_name: first.contact_name || '',
      contact_position: first.contact_position || '',
      contact_phone: first.contact_phone || '',
      items: selectedDeliveries.map(d => ({
        item_name: d.item_name || '',
        description: d.description || '',
        serial_ip: d.serial_ip || '',
        quantity: d.quantity,
        note: d.note || ''
      }))
    })
    setShowReceipt(true)
  }

  // 그룹 전체 삭제
  const handleDeleteGroup = async (group) => {
    const confirmMsg = `업체별 전체 삭제하시겠습니까?\n\n업체: ${group.client}\n담당자: ${group.contact_name || '-'}\n납품일: ${group.delivery_date}\n품목 수: ${group.items.length}개\n\n이 작업은 되돌릴 수 없습니다.`

    if (!confirm(confirmMsg)) return

    try {
      // 그룹의 모든 항목 삭제
      for (const item of group.items) {
        await deleteDelivery(item.id)
      }
      load(true)
    } catch (e) {
      alert(e.response?.data?.detail || '삭제에 실패했습니다')
    }
  }

  // 그룹 수정 모달 열기
  const openEditGroupModal = (group) => {
    setEditingGroup(group)
    // delivery_date가 null이면 미정 체크
    const isUndecided = !group.delivery_date
    setEditDeliveryUndecided(isUndecided)
    setEditDeliveryDate(group.delivery_date || new Date().toISOString().split('T')[0])
    setEditClient(group.client || '')
    setEditProjectName(group.project_name || '')
    setEditContactName(group.contact_name || '')
    setEditContactPhone(group.contact_phone || '')

    // 업체 정보 찾기
    const company = companies.find(c => c.company_name === group.client)
    setSelectedCompany(company || null)

    setEditGroupModal(true)
  }

  // 그룹 수정 처리
  const handleEditGroup = async () => {
    if (!editingGroup) return

    try {
      // client가 null이면 에러
      if (!editingGroup.client) {
        alert('업체명이 없는 그룹은 수정할 수 없습니다.')
        return
      }

      const payload = {
        delivery_date: editingGroup.delivery_date || null,  // 검색 조건용 원래 날짜 (NULL 허용)
        client: editingGroup.client,                        // 검색 조건용 원래 업체
        original_contact_name: editingGroup.contact_name || null,
        project_name: editProjectName || '',
        contact_name: editContactName || '',
        contact_phone: editContactPhone || ''
      }

      // 날짜 업데이트: 미정 체크 시 null, 아니면 날짜 값
      const newDate = editDeliveryUndecided ? null : editDeliveryDate
      const originalDate = editingGroup.delivery_date || null

      // 날짜가 변경된 경우에만 new_delivery_date 추가
      if (newDate !== originalDate) {
        payload.new_delivery_date = newDate
      }

      // 업체가 변경된 경우에만 new_client 추가
      if (editClient && editClient !== editingGroup.client) {
        payload.new_client = editClient
      }

      console.log('전송 데이터:', JSON.stringify(payload, null, 2))
      const response = await updateDeliveryGroup(payload)
      console.log('수정 성공:', response.data)
      setEditGroupModal(false)
      setEditingGroup(null)
      setSelectedCompany(null)
      load(true)
    } catch (e) {
      console.error('수정 실패:', e)
      const errorMsg = typeof e.response?.data?.detail === 'string'
        ? e.response.data.detail
        : JSON.stringify(e.response?.data) || e.message || '수정에 실패했습니다'
      alert(errorMsg)
    }
  }

  // 업체 선택
  const handleCompanySelect = (company) => {
    setSelectedCompany(company)
    setEditClient(company.company_name)
  }

  // 담당자 선택 시 연락처 자동 채우기
  const handleContactSelect = (contactName) => {
    if (!selectedCompany) return
    const contact = selectedCompany.contacts.find(c => c.name === contactName)
    if (contact) {
      setEditContactName(contact.name)
      setEditContactPhone(contact.phone || '')
    }
  }

  const pending = deliveries.filter(d => d.status === '납품예정')
  const groupedDeliveries = groupDeliveries(deliveries)

  return (
    <div className="p-6 min-h-full">
      <PageHeader title="납품 이력" sub={`총 ${deliveries.length}건`} icon={<RefreshCw onClick={load} className="cursor-pointer" />} />

      <div className="flex gap-3 mb-4 flex-wrap items-center">
        {/* 검색 박스 - 파란색 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <div className="relative">
            <Search size={14} className="absolute left-0 top-1/2 -translate-y-1/2 text-blue-400"/>
            <input
              type="text"
              placeholder="업체명, 프로젝트, 품명 검색..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent border-0 pl-6 pr-6 py-0.5 text-sm text-slate-700 placeholder:text-blue-300 focus:outline-none w-64"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-blue-400 hover:text-blue-600"
              >
                <X size={14}/>
              </button>
            )}
          </div>
        </div>

        {/* 납품예정 필터 박스 - 오렌지색 */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showPending}
              onChange={e => setShowPending(e.target.checked)}
              className="w-4 h-4 rounded border-orange-300 text-orange-500 focus:ring-2 focus:ring-orange-200 cursor-pointer"
            />
            <span className="text-sm font-medium text-orange-700">납품예정</span>
            <span className="text-xs text-orange-500">({allDeliveries.filter(d => d.status === '납품예정').length})</span>
          </label>
        </div>

        {/* 납품완료 필터 박스 - 초록색 */}
        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={e => setShowCompleted(e.target.checked)}
              className="w-4 h-4 rounded border-green-300 text-green-500 focus:ring-2 focus:ring-green-200 cursor-pointer"
            />
            <span className="text-sm font-medium text-green-700">납품완료</span>
            <span className="text-xs text-green-500">({allDeliveries.filter(d => d.status === '납품완료').length})</span>
          </label>
        </div>

        {/* 납품처리 박스 - 에메랄드색 (선택 시만 활성화) */}
        <div className={`rounded-lg px-4 py-2 transition-all ${
          selectedIds.size > 0
            ? 'bg-emerald-50 border border-emerald-200'
            : 'bg-slate-50 border border-slate-200 opacity-50'
        }`}>
          <button
            onClick={openConfirmModal}
            disabled={selectedIds.size === 0}
            className={`flex items-center gap-2 text-sm font-semibold transition-all ${
              selectedIds.size > 0
                ? 'text-emerald-700 cursor-pointer hover:text-emerald-800'
                : 'text-slate-400 cursor-not-allowed'
            }`}
          >
            <CheckCircle size={16}/>
            <span>납품처리</span>
            {selectedIds.size > 0 && (
              <span className="bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full text-xs font-bold">
                {selectedIds.size}
              </span>
            )}
          </button>
        </div>

        {/* 선택 인수증 출력 박스 - 보라색 (선택 시만 활성화) */}
        <div className={`rounded-lg px-4 py-2 transition-all ${
          selectedIds.size > 0
            ? 'bg-purple-50 border border-purple-200'
            : 'bg-slate-50 border border-slate-200 opacity-50'
        }`}>
          <button
            onClick={handlePrintSelectedReceipt}
            disabled={selectedIds.size === 0}
            className={`flex items-center gap-2 text-sm font-semibold transition-all ${
              selectedIds.size > 0
                ? 'text-purple-700 cursor-pointer hover:text-purple-800'
                : 'text-slate-400 cursor-not-allowed'
            }`}
          >
            <Printer size={16}/>
            <span>선택 항목 인수증</span>
            {selectedIds.size > 0 && (
              <span className="bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full text-xs font-bold">
                {selectedIds.size}
              </span>
            )}
          </button>
        </div>
      </div>

      <Table headers={[
        <input type="checkbox" checked={selectedIds.size === pending.length && pending.length > 0} onChange={toggleSelectAll} />,
        '업체명', '담당자', '품명', 'Serial/IP', '수량', '납품일', '상태', '비고', '', ''
      ]}>
        {loading && <Spinner/>}
        {!loading && deliveries.length===0 && <Empty/>}
        {!loading && groupedDeliveries.map((group, groupIdx) => {
          const groupState = getGroupSelectState(group)
          const hasPending = group.items.some(d => d.status === '납품예정')

          return (
            <React.Fragment key={group.key}>
              {/* 그룹 헤더 */}
              <tr className="bg-slate-100 border-t-2 border-slate-300">
                <td className="px-3 py-2">
                  {hasPending && (
                    <input
                      type="checkbox"
                      checked={groupState === 'all'}
                      ref={el => {
                        if (el) el.indeterminate = groupState === 'partial'
                      }}
                      onChange={() => toggleGroupSelect(group)}
                      className="cursor-pointer"
                    />
                  )}
                </td>
                <td colSpan="2" className="px-3 py-2 font-bold text-slate-700">
                  {group.client} {group.contact_name && `- ${group.contact_name}`}
                </td>
                <td colSpan="3" className="px-3 py-2 text-xs text-slate-600">
                  {group.project_name && `[${group.project_name}]`} 품목 {group.items.length}개
                </td>
                <td className="px-3 py-2 mono text-xs font-medium">{group.delivery_date}</td>
                <td className="px-3 py-2 text-xs">
                  {group.items.every(d => d.status === '납품완료') ? (
                    <span className="text-green-600 font-medium">납품완료</span>
                  ) : group.items.every(d => d.status === '납품예정') ? (
                    <span className="text-orange-600 font-medium">납품예정</span>
                  ) : (
                    <span className="text-slate-600 font-medium">혼합</span>
                  )}
                </td>
                <td className="px-3 py-2"></td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => openEditGroupModal(group)}
                    className="p-1 text-blue-500 hover:text-blue-700 transition-colors mr-1"
                    title="그룹 정보 수정"
                  >
                    <Edit2 size={16}/>
                  </button>
                  <button
                    onClick={() => handlePrintGroupReceipt(group)}
                    className="p-1 text-purple-500 hover:text-purple-700 transition-colors"
                    title="그룹 전체 인수증 출력"
                  >
                    <Printer size={16}/>
                  </button>
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => handleDeleteGroup(group)}
                    className="p-1 text-red-400 hover:text-red-600 transition-colors"
                    title="업체별 전체 삭제"
                  >
                    <Trash2 size={16}/>
                  </button>
                </td>
              </tr>

              {/* 그룹 내 품목들 */}
              {group.items.map((d, itemIdx) => (
                <tr key={d.id} className="inv-row" style={{ background: d.status === '납품완료' ? '#f1f5f9' : '#ffffff' }}>
                  <td className="px-3 py-2 pl-8">
                    {d.status === '납품예정' && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(d.id)}
                        onChange={() => toggleSelect(d.id)}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-400">└</td>
                  <td className="px-3 py-2 text-xs">{d.contact_name || '-'}</td>
                  <td className="px-3 py-2 font-medium">{d.item_name}</td>
                  <td className="px-3 py-2 mono text-xs">{d.ip || d.serial || '-'}</td>
                  <td className="px-3 py-2 mono text-center">{d.quantity}</td>
                  <td className="px-3 py-2 mono text-xs text-slate-400">〃</td>
                  <td className="px-3 py-2 text-xs">
                    {d.status === '납품예정' ? (
                      <span className="text-orange-600 font-medium">납품예정</span>
                    ) : (
                      <span className="text-green-600 font-medium">납품완료</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-dim max-w-[120px] truncate">{d.note || '-'}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => handlePrintReceipt(d)} className="p-1 text-dim hover:text-purple-500 transition-colors" title="개별 인수증 출력">
                      <Printer size={12}/>
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => handleDelete(d)} className="p-1 text-dim hover:text-red-500 transition-colors" title="삭제">
                      <Trash2 size={12}/>
                    </button>
                  </td>
                </tr>
              ))}
            </React.Fragment>
          )
        })}
      </Table>

      {/* 납품처리 모달 */}
      {confirmModal && (
        <Modal title={`납품처리 - ${selectedIds.size}개 항목`} onClose={() => setConfirmModal(false)}
          footer={<>
            <Btn onClick={() => setConfirmModal(false)} className="flex-1 justify-center">취소</Btn>
            <Btn onClick={handleConfirm} variant="green" className="flex-1 justify-center">
              <CheckCircle size={14}/> 납품완료 처리
            </Btn>
          </>}>
          <div className="space-y-3">
            <Field label="납품일 *">
              <input
                type="date"
                value={confirmDate}
                onChange={e => setConfirmDate(e.target.value)}
                className={inputCls}
              />
            </Field>
            <p className="text-sm text-slate-600">
              선택한 {selectedIds.size}개 항목을 납품완료로 처리하시겠습니까?
            </p>
            <p className="text-xs text-slate-500">
              · 납품완료 처리 시 재고에서 해당 수량만큼 차감됩니다.<br/>
              · 재고 수량이 0이 되면 해당 품목은 재고에서 제거됩니다.
            </p>
          </div>
        </Modal>
      )}

      {/* 인수증 출력 모달 */}
      {showReceipt && receiptData && (
        <EditableDeliveryReceipt data={receiptData} onClose={() => setShowReceipt(false)} />
      )}

      {/* 그룹 수정 모달 */}
      {editGroupModal && editingGroup && (
        <Modal
          title="납품 그룹 정보 수정"
          sub={`품목 ${editingGroup.items.length}개`}
          onClose={() => {
            setEditGroupModal(false)
            setEditingGroup(null)
            setSelectedCompany(null)
          }}
          footer={<>
            <Btn onClick={() => {
              setEditGroupModal(false)
              setEditingGroup(null)
              setSelectedCompany(null)
            }} className="flex-1 justify-center">취소</Btn>
            <Btn onClick={handleEditGroup} variant="blue" className="flex-1 justify-center">
              <Edit2 size={14}/> 수정
            </Btn>
          </>}
        >
          <div className="space-y-3">
            <div className="bg-slate-100 px-3 py-2 rounded text-sm text-slate-600">
              <div>원래 업체: {editingGroup.client}</div>
              <div>원래 납품일: {editingGroup.delivery_date}</div>
            </div>

            <Field label="납품일">
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={editDeliveryDate}
                  onChange={e => setEditDeliveryDate(e.target.value)}
                  disabled={editDeliveryUndecided}
                  className={inputCls}
                />
                <label className="flex items-center gap-1.5 cursor-pointer select-none whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={editDeliveryUndecided}
                    onChange={e => setEditDeliveryUndecided(e.target.checked)}
                    className="w-4 h-4 rounded accent-blue-500"
                  />
                  <span className="text-sm text-slate-600">미정</span>
                </label>
              </div>
            </Field>

            <Field label="업체명 *">
              <CompanyAutocomplete
                value={editClient}
                onChange={setEditClient}
                companies={companies}
                onSelectCompany={handleCompanySelect}
              />
            </Field>

            <Field label="프로젝트명">
              <input
                type="text"
                value={editProjectName}
                onChange={e => setEditProjectName(e.target.value)}
                className={inputCls}
                placeholder="프로젝트명"
              />
            </Field>

            <Field label="담당자">
              <input
                type="text"
                list="edit-contact-list"
                value={editContactName}
                onChange={(e) => {
                  const val = e.target.value
                  setEditContactName(val)
                  handleContactSelect(val)
                }}
                className={inputCls}
                placeholder="담당자명"
              />
              {selectedCompany && selectedCompany.contacts && selectedCompany.contacts.length > 0 && (
                <datalist id="edit-contact-list">
                  {selectedCompany.contacts.map((c, i) => (
                    <option key={i} value={c.name} />
                  ))}
                </datalist>
              )}
            </Field>

            <Field label="연락처">
              <input
                type="text"
                value={editContactPhone}
                onChange={e => setEditContactPhone(e.target.value)}
                className={inputCls}
                placeholder="010-1234-5678"
              />
            </Field>

            <p className="text-xs text-slate-500">
              * 이 그룹의 모든 납품 항목({editingGroup.items.length}개)에 일괄 적용됩니다.
            </p>
          </div>
        </Modal>
      )}

      {/* 하단 플로팅 액션바 - 체크박스 선택 시 표시 */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-slide-up">
          <div className="bg-slate-800 text-white px-5 py-3 rounded-full shadow-lg flex items-center gap-3">
            <span className="text-sm font-medium">
              <span className="text-blue-400">{selectedIds.size}개</span> 선택됨
            </span>
            <div className="w-px h-5 bg-slate-600"/>
            <button
              onClick={openConfirmModal}
              className="flex items-center gap-2 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 rounded-full text-sm font-medium transition-colors"
            >
              <CheckCircle size={14}/> 납품처리
            </button>
            <button
              onClick={handlePrintSelectedReceipt}
              className="flex items-center gap-2 px-4 py-1.5 bg-purple-500 hover:bg-purple-600 rounded-full text-sm font-medium transition-colors"
            >
              <Printer size={14}/> 인수증
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="p-1.5 hover:bg-slate-700 rounded-full transition-colors"
              title="선택 해제"
            >
              <X size={16}/>
            </button>
          </div>
        </div>
      )}

      <ScrollToTop />
    </div>
  )
}
