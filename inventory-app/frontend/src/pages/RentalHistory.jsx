import React, { useState, useEffect, useCallback, useRef } from 'react'
import { getRentals, returnRental, extendRental, deleteRental, deleteRentalGroup, updateRentalGroup, updateRentalItem, getItems, createRental, toggleNeedsCheck } from '../api.js'
import { PageHeader, Table, Spinner, Empty, Btn, Modal, Field, inputCls } from '../components/Common.jsx'
import { RefreshCw, Search, CheckCircle, Trash2, Printer, Calendar, Edit2, X, Plus, AlertCircle } from 'lucide-react'
import dayjs from 'dayjs'
import { usePersistedState } from '../hooks/usePersistedState.js'
import { useScrollRestore } from '../hooks/useScrollRestore.js'
import EditableRentalReceipt from '../components/EditableRentalReceipt.jsx'
import ScrollToTop from '../components/ScrollToTop.jsx'

export default function RentalHistory() {
  const [rentals, setRentals] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = usePersistedState('rental_history_search', '')
  const [showRenting, setShowRenting] = usePersistedState('rental_history_show_renting_v2', true)
  const [showReturned, setShowReturned] = usePersistedState('rental_history_show_returned_v2', false)
  const [showNeedsCheckOnly, setShowNeedsCheckOnly] = usePersistedState('rental_history_show_needs_check', false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [returnModal, setReturnModal] = useState(false)
  const [returnDate, setReturnDate] = useState(dayjs().format('YYYY-MM-DD'))
  const [returnNote, setReturnNote] = useState('')
  const [returnQuantities, setReturnQuantities] = useState({})
  const [returnStatuses, setReturnStatuses] = useState({}) // 반납 상태 (rental_id별) - 새제품/데모
  const [showReceipt, setShowReceipt] = useState(false)
  const [receiptData, setReceiptData] = useState(null)
  const [extendModal, setExtendModal] = useState(false)
  const [extendRentalId, setExtendRentalId] = useState(null)
  const [extendDate, setExtendDate] = useState('')
  const [extendNote, setExtendNote] = useState('')
  const [editGroupModal, setEditGroupModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState(null)
  const [editContactName, setEditContactName] = useState('')
  const [editContactPhone, setEditContactPhone] = useState('')
  const [editExpectedReturn, setEditExpectedReturn] = useState('')
  const [editReturnUndecided, setEditReturnUndecided] = useState(false)
  const [allItems, setAllItems] = useState([])
  const [newItems, setNewItems] = useState([])
  const [editingItems, setEditingItems] = useState({}) // 기존 품목 수정 (rental_id → 수정내용)

  useScrollRestore('rental_history_page', [rentals])

  // 아이템 목록 로드
  useEffect(() => {
    getItems({}).then(r => setAllItems(r.data)).catch(console.error)
  }, [])

  // 대여 데이터를 그룹화하는 함수 (같은 날짜, 업체, 담당자)
  const groupRentals = (rentals) => {
    const groups = {}

    rentals.forEach(rental => {
      const key = `${rental.rent_date}|${rental.borrower}|${rental.contact_name || ''}`
      if (!groups[key]) {
        groups[key] = {
          key,
          rent_date: rental.rent_date,
          borrower: rental.borrower,
          contact_name: rental.contact_name,
          contact_position: rental.contact_position,
          contact_phone: rental.contact_phone,
          purpose: rental.purpose,
          expected_return: rental.expected_return,
          items: []
        }
      }
      groups[key].items.push(rental)
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
      const r = await getRentals({ active: null })

      // 상태 필터링 - 각각 체크된 항목만 보이기
      let filtered = r.data.filter(item => {
        const isReturned = !!item.returned_at
        if (isReturned) {
          return showReturned  // 반납완료된 항목은 showReturned가 true일 때만
        } else {
          return showRenting   // 대여중 항목은 showRenting이 true일 때만
        }
      })

      // 검색어 필터링
      if (search) {
        const query = search.toLowerCase()
        filtered = filtered.filter(item =>
          (item.borrower && item.borrower.toLowerCase().includes(query)) ||
          (item.item_name && item.item_name.toLowerCase().includes(query)) ||
          (item.description && item.description.toLowerCase().includes(query))
        )
      }

      // 확인필요만 필터링
      if (showNeedsCheckOnly) {
        filtered = filtered.filter(item => item.needs_check)
      }

      setRentals(filtered)

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
  }, [search, showRenting, showReturned, showNeedsCheckOnly])

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
    const unreturned = rentals.filter(r => !r.returned_at)
    if (selectedIds.size === unreturned.length && unreturned.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(unreturned.map(r => r.id)))
    }
  }

  // 그룹 전체 선택/해제
  const toggleGroupSelect = (group) => {
    const unreturnedInGroup = group.items.filter(r => !r.returned_at)
    const allSelected = unreturnedInGroup.every(r => selectedIds.has(r.id))

    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (allSelected) {
        // 모두 선택되어 있으면 해제
        unreturnedInGroup.forEach(r => newSet.delete(r.id))
      } else {
        // 하나라도 선택 안되어 있으면 모두 선택
        unreturnedInGroup.forEach(r => newSet.add(r.id))
      }
      return newSet
    })
  }

  // 그룹 내 선택 상태 확인
  const getGroupSelectState = (group) => {
    const unreturnedInGroup = group.items.filter(r => !r.returned_at)
    if (unreturnedInGroup.length === 0) return 'none'

    const selectedCount = unreturnedInGroup.filter(r => selectedIds.has(r.id)).length
    if (selectedCount === 0) return 'none'
    if (selectedCount === unreturnedInGroup.length) return 'all'
    return 'partial'
  }

  const openReturnModal = () => {
    if (selectedIds.size === 0) {
      alert('반납할 항목을 선택하세요')
      return
    }

    // 선택된 항목들의 수량 및 반납 상태 초기화
    const initialQuantities = {}
    const initialStatuses = {}
    rentals.forEach(r => {
      if (selectedIds.has(r.id)) {
        initialQuantities[r.id] = r.quantity || 1
        // 기본값: 대여 당시 원래 상태 (original_status) 또는 데모
        initialStatuses[r.id] = r.original_status || '데모'
      }
    })
    setReturnQuantities(initialQuantities)
    setReturnStatuses(initialStatuses)
    setReturnModal(true)
  }

  const handleReturn = async () => {
    if (selectedIds.size === 0) {
      alert('반납할 항목을 선택하세요')
      return
    }

    const failedIds = []
    for (const id of selectedIds) {
      try {
        const returnQty = returnQuantities[id]
        const returnStatus = returnStatuses[id] || '데모'

        await returnRental(id, {
          returned_at: returnDate,
          return_quantity: returnQty,
          note: returnNote,
          return_status: returnStatus
        })
      } catch (e) {
        failedIds.push(id)
      }
    }

    // 항상 화면 갱신 (일부 성공했을 수 있으므로)
    setReturnModal(false)
    setSelectedIds(new Set())
    setReturnNote('')
    setReturnQuantities({})
    setReturnStatuses({})
    // 아이템 목록도 새로고침
    getItems({}).then(r => setAllItems(r.data)).catch(console.error)
    load(true)

    if (failedIds.length > 0) {
      alert(`${failedIds.length}건의 반납 처리에 실패했습니다`)
    }
  }

  const handleExtend = async () => {
    if (!extendDate) {
      alert('새로운 반납예정일을 입력하세요')
      return
    }

    try {
      // 다중 선택 모드 (일괄 연장)
      if (selectedIds.size > 0) {
        for (const id of selectedIds) {
          await extendRental(id, {
            new_expected_return: extendDate,
            note: extendNote
          })
        }
        setSelectedIds(new Set())
      }
      // 단일 선택 모드 (개별 연장)
      else if (extendRentalId) {
        await extendRental(extendRentalId, {
          new_expected_return: extendDate,
          note: extendNote
        })
      }

      setExtendModal(false)
      setExtendRentalId(null)
      setExtendDate('')
      setExtendNote('')
      load(true)
    } catch (e) {
      alert(e.response?.data?.detail || '연장 처리에 실패했습니다')
    }
  }

  const openExtendModal = (rental = null) => {
    if (rental) {
      // 개별 연장 모드
      setExtendRentalId(rental.id)
      const baseDate = rental.expected_return || dayjs().format('YYYY-MM-DD')
      setExtendDate(dayjs(baseDate).add(7, 'day').format('YYYY-MM-DD'))
    } else {
      // 일괄 연장 모드 (선택된 항목들)
      setExtendRentalId(null)
      setExtendDate(dayjs().add(7, 'day').format('YYYY-MM-DD'))
    }
    setExtendModal(true)
  }

  const handleDelete = async (r) => {
    if (!confirm(`대여 기록을 삭제할까요?\n업체: ${r.borrower}\n품명: ${r.item_name || '-'}`)) return
    try {
      await deleteRental(r.id)
      load(true)
    } catch (e) {
      alert(e.response?.data?.detail || '삭제에 실패했습니다')
    }
  }

  // 확인필요 토글
  const handleToggleNeedsCheck = async (rentalId) => {
    try {
      await toggleNeedsCheck(rentalId)
      load(true)
    } catch (e) {
      alert('확인필요 변경에 실패했습니다')
    }
  }

  // 개별 품목 대여증 출력
  const handlePrintReceipt = (r) => {
    // item_id가 있으면: description은 아이템 규격, serial/ip는 아이템에서 가져옴
    // item_id가 없으면: description은 빈값, serial_ip는 저장된 r.description 사용
    const hasItem = !!r.item_id
    setReceiptData({
      borrower: r.borrower,
      contact_name: r.contact_name || '',
      contact_position: r.contact_position || '',
      contact_phone: r.contact_phone || '',
      rent_date: r.rent_date,
      expected_return: r.expected_return || '',
      purpose: r.purpose || '',
      items: [{
        item_name: r.item_name || '',
        description: hasItem ? (r.description || '') : '',
        serial_ip: hasItem ? (r.ip || r.serial || '') : (r.description || ''),
        quantity: r.quantity,
        note: r.note || ''
      }]
    })
    setShowReceipt(true)
  }

  // 그룹 대여증 출력
  const handlePrintGroupReceipt = (group) => {
    setReceiptData({
      borrower: group.borrower,
      contact_name: group.contact_name || '',
      contact_position: group.contact_position || '',
      contact_phone: group.contact_phone || '',
      rent_date: group.rent_date,
      expected_return: group.expected_return || '',
      purpose: group.purpose || '',
      items: group.items.map(r => {
        const hasItem = !!r.item_id
        return {
          item_name: r.item_name || '',
          description: hasItem ? (r.description || '') : '',
          serial_ip: hasItem ? (r.ip || r.serial || '') : (r.description || ''),
          quantity: r.quantity,
          note: r.note || ''
        }
      })
    })
    setShowReceipt(true)
  }

  // 그룹 전체 삭제
  const handleDeleteGroup = async (group) => {
    const confirmMsg = `업체별 전체 삭제하시겠습니까?\n\n업체: ${group.borrower}\n담당자: ${group.contact_name || '-'}\n대여일: ${group.rent_date}\n품목 수: ${group.items.length}개\n\n이 작업은 되돌릴 수 없습니다.`

    if (!confirm(confirmMsg)) return

    try {
      await deleteRentalGroup({
        rent_date: group.rent_date,
        borrower: group.borrower,
        contact_name: group.contact_name || null
      })
      load(true)
    } catch (e) {
      alert(e.response?.data?.detail || '삭제에 실패했습니다')
    }
  }

  // 그룹 수정 모달 열기
  const openEditGroupModal = (group) => {
    setEditingGroup(group)
    setEditContactName(group.contact_name || '')
    setEditContactPhone(group.contact_phone || '')
    setEditExpectedReturn(group.expected_return || '')
    setEditReturnUndecided(!group.expected_return)
    setNewItems([])
    setEditingItems({}) // 기존 품목 수정 초기화
    // 아이템 목록 새로고침
    getItems({}).then(r => setAllItems(r.data)).catch(console.error)
    setEditGroupModal(true)
  }

  // 기존 품목 수정 시작
  const startEditItem = (rental) => {
    setEditingItems(prev => ({
      ...prev,
      [rental.id]: {
        item_id: rental.item_id,
        item_name: rental.item_name || '',
        description: rental.description || '',
        quantity: rental.quantity || 1,
        note: '',
        original: rental
      }
    }))
  }

  // 기존 품목 수정 취소
  const cancelEditItem = (rentalId) => {
    setEditingItems(prev => {
      const next = { ...prev }
      delete next[rentalId]
      return next
    })
  }

  // 기존 품목 필드 업데이트
  const updateEditingItem = (rentalId, field, value) => {
    setEditingItems(prev => ({
      ...prev,
      [rentalId]: { ...prev[rentalId], [field]: value }
    }))
  }

  // 기존 품목 품명 선택 시 (자동완성)
  const handleEditItemName = (rentalId, itemName) => {
    const matched = allItems.find(i => i.status === '데모' && i.item_name === itemName)
    if (matched) {
      setEditingItems(prev => ({
        ...prev,
        [rentalId]: {
          ...prev[rentalId],
          item_name: itemName,
          description: matched.description || '',
          item_id: null // 품명 변경 시 item_id 초기화
        }
      }))
    } else {
      updateEditingItem(rentalId, 'item_name', itemName)
    }
  }

  // 기존 품목 IP/장비 선택 시
  const handleEditItemIP = (rentalId, selectedItem) => {
    setEditingItems(prev => ({
      ...prev,
      [rentalId]: {
        ...prev[rentalId],
        item_id: selectedItem.id,
        item_name: selectedItem.item_name,
        description: selectedItem.description || ''
      }
    }))
  }

  // 새 품목 추가
  const addNewItem = () => {
    setNewItems(prev => [...prev, { item_id: null, item_name: '', item_description: '', serial_ip: '', quantity: 1, note: '' }])
  }

  // 새 품목 삭제
  const removeNewItem = (idx) => {
    setNewItems(prev => prev.filter((_, i) => i !== idx))
  }

  // 새 품목 필드 업데이트
  const updateNewItem = (idx, field, value) => {
    setNewItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  // 품명 선택 시 규격 자동 채우기
  const handleSelectItemName = (idx, itemName) => {
    const matched = allItems.find(i => i.status === '데모' && i.item_name === itemName)
    if (matched) {
      setNewItems(prev => prev.map((item, i) => i === idx ? {
        ...item,
        item_name: itemName,
        item_description: matched.description || '',
        item_id: null,
        serial_ip: ''
      } : item))
    } else {
      updateNewItem(idx, 'item_name', itemName)
    }
  }

  // IP 선택 시 item_id 설정
  const handleSelectIP = (idx, selectedItem) => {
    setNewItems(prev => prev.map((item, i) => i === idx ? {
      ...item,
      item_id: selectedItem.id,
      serial_ip: selectedItem.ip || selectedItem.serial || ''
    } : item))
  }

  // 그룹 수정 처리
  const handleEditGroup = async () => {
    if (!editingGroup) return

    try {
      // 기존 그룹 정보 수정
      await updateRentalGroup({
        rent_date: editingGroup.rent_date,
        borrower: editingGroup.borrower,
        original_contact_name: editingGroup.contact_name || null,
        contact_name: editContactName,
        contact_phone: editContactPhone,
        expected_return: editReturnUndecided ? null : editExpectedReturn,
        note: '그룹 정보 수정'
      })

      // 기존 품목 수정 처리
      for (const [rentalId, editData] of Object.entries(editingItems)) {
        const original = editData.original
        const hasChanges =
          editData.item_id !== original.item_id ||
          editData.item_name !== (original.item_name || '') ||
          editData.quantity !== (original.quantity || 1)

        if (hasChanges) {
          await updateRentalItem(parseInt(rentalId), {
            item_id: editData.item_id !== original.item_id ? editData.item_id : undefined,
            item_name: editData.item_name !== (original.item_name || '') ? editData.item_name : undefined,
            quantity: editData.quantity !== (original.quantity || 1) ? editData.quantity : undefined,
            note: editData.note || undefined
          })
        }
      }

      // 새 품목 추가
      const validNewItems = newItems.filter(item => item.item_name.trim())
      for (const item of validNewItems) {
        await createRental({
          item_id: item.item_id,
          item_name: item.item_name,
          description: item.item_id ? '' : item.serial_ip, // item_id 있으면 빈값, 없으면 serial_ip
          borrower: editingGroup.borrower,
          contact_name: editContactName,
          contact_position: editingGroup.contact_position || '',
          contact_phone: editContactPhone,
          purpose: editingGroup.purpose || '',
          quantity: parseInt(item.quantity) || 1,
          rent_date: editingGroup.rent_date,
          expected_return: editReturnUndecided ? null : editExpectedReturn,
          note: item.note || '품목 추가'
        })
      }

      setEditGroupModal(false)
      setEditingGroup(null)
      setNewItems([])
      setEditingItems({})
      // 아이템 목록 새로고침 (상태 변경 반영)
      getItems({}).then(r => setAllItems(r.data)).catch(console.error)
      load(true)
    } catch (e) {
      alert(e.response?.data?.detail || '수정에 실패했습니다')
    }
  }

  // 선택된 항목들 대여증 출력
  const handlePrintSelectedReceipt = () => {
    if (selectedIds.size === 0) {
      alert('출력할 항목을 선택하세요')
      return
    }

    const selectedRentals = rentals.filter(r => selectedIds.has(r.id))
    if (selectedRentals.length === 0) return

    // 첫 번째 항목 기준으로 공통 정보 설정
    const first = selectedRentals[0]
    setReceiptData({
      borrower: first.borrower,
      contact_name: first.contact_name || '',
      contact_position: first.contact_position || '',
      contact_phone: first.contact_phone || '',
      rent_date: first.rent_date,
      expected_return: first.expected_return || '',
      purpose: first.purpose || '',
      items: selectedRentals.map(r => {
        const hasItem = !!r.item_id
        return {
          item_name: r.item_name || '',
          description: hasItem ? (r.description || '') : '',
          serial_ip: hasItem ? (r.ip || r.serial || '') : (r.description || ''),
          quantity: r.quantity,
          note: r.note || ''
        }
      })
    })
    setShowReceipt(true)
  }

  const unreturned = rentals.filter(r => !r.returned_at)
  const groupedRentals = groupRentals(rentals)

  return (
    <div className="p-6 min-h-full">
      <style>{`
        .rental-history-table th, .rental-history-table td { white-space: nowrap; }
        .rental-history-table th:nth-child(1), .rental-history-table td:nth-child(1) { width: 30px; }
        .rental-history-table th:nth-child(2), .rental-history-table td:nth-child(2) { width: 30px; }
        .rental-history-table th:nth-child(3), .rental-history-table td:nth-child(3) { width: 100px; }
        .rental-history-table th:nth-child(4), .rental-history-table td:nth-child(4) { width: 60px; }
        .rental-history-table th:nth-child(5), .rental-history-table td:nth-child(5) { width: 160px; max-width: 160px; overflow: hidden; text-overflow: ellipsis; }
        .rental-history-table th:nth-child(6), .rental-history-table td:nth-child(6) { width: 100px; }
        .rental-history-table th:nth-child(7), .rental-history-table td:nth-child(7) { width: 50px; text-align: center; }
        .rental-history-table th:nth-child(8), .rental-history-table td:nth-child(8) { width: 60px; }
        .rental-history-table th:nth-child(9), .rental-history-table td:nth-child(9) { width: 60px; }
        .rental-history-table th:nth-child(10), .rental-history-table td:nth-child(10) { width: 60px; }
        .rental-history-table th:nth-child(11), .rental-history-table td:nth-child(11) { width: 140px; max-width: 140px; overflow: hidden; text-overflow: ellipsis; }
        .rental-history-table th:nth-child(12), .rental-history-table td:nth-child(12) { width: 60px; }
        .rental-history-table th:nth-child(13), .rental-history-table td:nth-child(13) { width: 40px; }
      `}</style>
      <PageHeader title="대여 이력" icon={<RefreshCw onClick={load} className="cursor-pointer" />} />

      <div className="flex gap-3 mb-4 flex-wrap items-center">
        {/* 검색 박스 - 파란색 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <div className="relative">
            <Search size={14} className="absolute left-0 top-1/2 -translate-y-1/2 text-blue-400"/>
            <input
              type="text"
              placeholder="업체명, 품명, Serial/IP 검색..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent border-0 pl-6 pr-6 py-0.5 text-sm text-slate-700 placeholder:text-blue-300 focus:outline-none w-56"
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

        {/* 대여중 필터 박스 - 노란색 */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showRenting}
              onChange={e => setShowRenting(e.target.checked)}
              className="w-4 h-4 rounded border-amber-300 text-amber-500 focus:ring-2 focus:ring-amber-200 cursor-pointer"
            />
            <span className="text-sm font-medium text-amber-700">대여중</span>
            <span className="text-xs text-amber-500">({rentals.filter(r => !r.returned_at).length})</span>
          </label>
        </div>

        {/* 반납완료 필터 박스 - 초록색 */}
        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showReturned}
              onChange={e => setShowReturned(e.target.checked)}
              className="w-4 h-4 rounded border-green-300 text-green-500 focus:ring-2 focus:ring-green-200 cursor-pointer"
            />
            <span className="text-sm font-medium text-green-700">반납완료</span>
            <span className="text-xs text-green-500">({rentals.filter(r => r.returned_at).length})</span>
          </label>
        </div>

        {/* 확인필요만 필터 박스 - 주황색 */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showNeedsCheckOnly}
              onChange={e => setShowNeedsCheckOnly(e.target.checked)}
              className="w-4 h-4 rounded border-orange-300 text-orange-500 focus:ring-2 focus:ring-orange-200 cursor-pointer"
            />
            <AlertCircle size={14} className="text-orange-500" />
            <span className="text-sm font-medium text-orange-700">확인필요만</span>
            <span className="text-xs text-orange-500">({rentals.filter(r => r.needs_check).length})</span>
          </label>
        </div>

        {/* 반납처리 박스 - 에메랄드색 (선택 시만 활성화) */}
        <div className={`rounded-lg px-4 py-2 transition-all ${
          selectedIds.size > 0
            ? 'bg-emerald-50 border border-emerald-200'
            : 'bg-slate-50 border border-slate-200 opacity-50'
        }`}>
          <button
            onClick={openReturnModal}
            disabled={selectedIds.size === 0}
            className={`flex items-center gap-2 text-sm font-semibold transition-all ${
              selectedIds.size > 0
                ? 'text-emerald-700 cursor-pointer hover:text-emerald-800'
                : 'text-slate-400 cursor-not-allowed'
            }`}
          >
            <CheckCircle size={16}/>
            <span>반납처리</span>
            {selectedIds.size > 0 && (
              <span className="bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full text-xs font-bold">
                {selectedIds.size}
              </span>
            )}
          </button>
        </div>

        {/* 연장처리 박스 - 파란색 (선택 시만 활성화) */}
        <div className={`rounded-lg px-4 py-2 transition-all ${
          selectedIds.size > 0
            ? 'bg-blue-50 border border-blue-200'
            : 'bg-slate-50 border border-slate-200 opacity-50'
        }`}>
          <button
            onClick={() => openExtendModal()}
            disabled={selectedIds.size === 0}
            className={`flex items-center gap-2 text-sm font-semibold transition-all ${
              selectedIds.size > 0
                ? 'text-blue-700 cursor-pointer hover:text-blue-800'
                : 'text-slate-400 cursor-not-allowed'
            }`}
          >
            <Calendar size={16}/>
            <span>연장처리</span>
            {selectedIds.size > 0 && (
              <span className="bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full text-xs font-bold">
                {selectedIds.size}
              </span>
            )}
          </button>
        </div>

        {/* 선택 대여증 출력 박스 - 보라색 (선택 시만 활성화) */}
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
            <span>선택 항목 대여증</span>
            {selectedIds.size > 0 && (
              <span className="bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full text-xs font-bold">
                {selectedIds.size}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="rental-history-table">
        <Table cards headers={[
          <input type="checkbox" checked={selectedIds.size === unreturned.length && unreturned.length > 0} onChange={toggleSelectAll} />,
          '확인', '업체명', '담당자', '품명', 'Serial/IP', '수량', '대여일', '반납예정', '실제반납', '비고', '', ''
        ]}>
        {loading && <Spinner />}
        {!loading && rentals.length === 0 && <Empty />}
        {!loading && groupedRentals.map((group, groupIdx) => {
          const groupState = getGroupSelectState(group)
          const hasUnreturned = group.items.some(r => !r.returned_at)

          return (
            <React.Fragment key={group.key}>
              {/* 그룹 헤더 */}
              <tr className="bg-slate-100 border-t-2 border-slate-300">
                <td className="px-3 py-2">
                  {hasUnreturned && (
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
                <td className="px-3 py-2"></td>
                <td colSpan="2" className="px-3 py-2 font-bold text-slate-700">
                  {group.borrower}
                </td>
                <td colSpan="3" className="px-3 py-2 text-xs text-slate-600">
                  {group.purpose && `[${group.purpose}]`} 품목 {group.items.length}개
                </td>
                <td className="px-3 py-2 mono text-xs font-medium">{group.rent_date}</td>
                <td className="px-3 py-2 mono text-xs">{group.expected_return || '-'}</td>
                <td colSpan="2" className="px-3 py-2"></td>
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
                    title="그룹 전체 대여증 출력"
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
              {group.items.map((r, itemIdx) => (
                <tr key={r.id} className="inv-row" style={{ background: r.returned_at ? '#f1f5f9' : (r.needs_check ? '#fef3c7' : '#ffffff') }}>
                  <td className="px-3 py-2 pl-8">
                    {!r.returned_at && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(r.id)}
                        onChange={() => toggleSelect(r.id)}
                      />
                    )}
                  </td>
                  <td className="px-3 py-1">
                    <button
                      onClick={() => handleToggleNeedsCheck(r.id)}
                      className={`p-1 rounded transition-colors ${r.needs_check ? 'text-orange-500 hover:text-orange-700' : 'text-slate-300 hover:text-orange-400'}`}
                      title={r.needs_check ? '확인필요 해제' : '확인필요 표시'}
                    >
                      <AlertCircle size={16} style={r.needs_check ? { fill: '#fed7aa' } : {}} />
                    </button>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-400">└</td>
                  <td className="px-3 py-2 text-xs">{r.contact_name || '-'}</td>
                  <td className="px-3 py-2 font-medium">{r.item_name || '-'}</td>
                  <td className="px-3 py-2 mono text-xs">{r.ip || r.serial || '-'}</td>
                  <td className="px-3 py-2 mono text-center">{r.quantity}</td>
                  <td className="px-3 py-2 mono text-xs text-slate-400">〃</td>
                  <td className="px-3 py-2 mono text-xs text-slate-400">〃</td>
                  <td className="px-3 py-2 mono text-xs">
                    {r.returned_at ? <span className="text-green-600">{r.returned_at}</span> : <span className="text-orange-600 font-bold">대여중</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-dim">{r.note || '-'}</td>
                  <td className="px-3 py-2">
                    {!r.returned_at && (
                      <button
                        onClick={() => openExtendModal(r)}
                        className="p-1 text-dim hover:text-blue-500 transition-colors mr-1"
                        title="대여 연장"
                      >
                        <Calendar size={12}/>
                      </button>
                    )}
                    <button onClick={() => handlePrintReceipt(r)} className="p-1 text-dim hover:text-blue-500 transition-colors" title="개별 대여증 출력">
                      <Printer size={12}/>
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => handleDelete(r)} className="p-1 text-dim hover:text-red-500 transition-colors" title="삭제">
                      <Trash2 size={12}/>
                    </button>
                  </td>
                </tr>
              ))}
            </React.Fragment>
          )
        })}
        </Table>
      </div>

      {/* 반납처리 모달 */}
      {returnModal && (
        <Modal title={`반납처리 - ${selectedIds.size}개 항목`} size="xl" onClose={() => setReturnModal(false)}
          footer={<>
            <Btn onClick={() => setReturnModal(false)} className="flex-1 justify-center">취소</Btn>
            <Btn onClick={handleReturn} variant="green" className="flex-1 justify-center">
              <CheckCircle size={14}/> 반납처리
            </Btn>
          </>}>
          <div className="space-y-4">
            <Field label="반납일 *">
              <input
                type="date"
                value={returnDate}
                onChange={e => setReturnDate(e.target.value)}
                className={inputCls}
              />
            </Field>

            <Field label="반납 항목 및 수량">
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-slate-700">품명</th>
                        <th className="px-3 py-2 text-left font-medium text-slate-700">Serial/IP</th>
                        <th className="px-3 py-2 text-center font-medium text-slate-700">대여수량</th>
                        <th className="px-3 py-2 text-center font-medium text-slate-700">반납수량</th>
                        <th className="px-3 py-2 text-center font-medium text-slate-700">반납상태</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {rentals.filter(r => selectedIds.has(r.id)).map(r => (
                          <tr key={r.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2">{r.item_name || '-'}</td>
                            <td className="px-3 py-2 mono text-xs">{r.ip || r.serial || r.description || '-'}</td>
                            <td className="px-3 py-2 text-center mono">{r.quantity || 1}</td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="1"
                                max={r.quantity || 1}
                                value={returnQuantities[r.id] || (r.quantity || 1)}
                                onChange={e => {
                                  const val = parseInt(e.target.value) || 1
                                  const maxQty = r.quantity || 1
                                  setReturnQuantities(prev => ({
                                    ...prev,
                                    [r.id]: Math.min(Math.max(1, val), maxQty)
                                  }))
                                }}
                                className="w-20 px-2 py-1 border border-slate-300 rounded text-center mono"
                              />
                            </td>
                            <td className="px-3 py-2 text-center">
                              <select
                                value={returnStatuses[r.id] || '데모'}
                                onChange={e => {
                                  setReturnStatuses(prev => ({
                                    ...prev,
                                    [r.id]: e.target.value
                                  }))
                                }}
                                className="px-2 py-1 text-xs border border-slate-300 rounded bg-white"
                              >
                                <option value="데모">데모</option>
                                <option value="새제품">새제품</option>
                              </select>
                            </td>
                          </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                * 부분 반납 시 남은 수량은 계속 대여중으로 유지됩니다
              </p>
              <p className="text-xs text-blue-500 mt-1">
                * 반납상태: 해당 품명의 "데모" 또는 "새제품" 재고에 수량이 복구됩니다
              </p>
            </Field>

            <Field label="비고">
              <textarea
                value={returnNote}
                onChange={e => setReturnNote(e.target.value)}
                className={inputCls}
                rows={3}
                placeholder="반납 관련 메모"
              />
            </Field>
          </div>
        </Modal>
      )}

      {/* 대여 연장 모달 */}
      {extendModal && (
        <Modal
          title={selectedIds.size > 0 ? `연장처리 - ${selectedIds.size}개 항목` : '대여 연장'}
          onClose={() => {
            setExtendModal(false)
            setExtendRentalId(null)
            setExtendDate('')
            setExtendNote('')
          }}
          footer={<>
            <Btn onClick={() => {
              setExtendModal(false)
              setExtendRentalId(null)
              setExtendDate('')
              setExtendNote('')
            }} className="flex-1 justify-center">취소</Btn>
            <Btn onClick={handleExtend} variant="blue" className="flex-1 justify-center">
              <Calendar size={14}/> 연장 처리
            </Btn>
          </>}
        >
          <div className="space-y-3">
            <Field label="새로운 반납예정일 *">
              <input
                type="date"
                value={extendDate}
                onChange={e => setExtendDate(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="연장 사유">
              <textarea
                value={extendNote}
                onChange={e => setExtendNote(e.target.value)}
                className={inputCls}
                rows={3}
                placeholder="연장 사유 입력 (선택사항)"
              />
            </Field>
          </div>
        </Modal>
      )}

      {/* 그룹 수정 모달 */}
      {editGroupModal && editingGroup && (
        <Modal
          title={`그룹 정보 수정 - ${editingGroup.borrower}`}
          onClose={() => {
            setEditGroupModal(false)
            setEditingGroup(null)
          }}
          footer={<>
            <Btn onClick={() => {
              setEditGroupModal(false)
              setEditingGroup(null)
            }} className="flex-1 justify-center">취소</Btn>
            <Btn onClick={handleEditGroup} variant="blue" className="flex-1 justify-center">
              <Edit2 size={14}/> 수정
            </Btn>
          </>}
        >
          <div className="space-y-3">
            <div className="bg-slate-100 px-3 py-2 rounded text-sm text-slate-600">
              <div>대여일: {editingGroup.rent_date}</div>
              <div>품목 수: {editingGroup.items.length}개</div>
            </div>

            <Field label="담당자">
              <input
                type="text"
                value={editContactName}
                onChange={e => setEditContactName(e.target.value)}
                className={inputCls}
                placeholder="담당자명"
              />
            </Field>

            <Field label="연락처">
              <input
                type="text"
                value={editContactPhone}
                onChange={e => setEditContactPhone(e.target.value)}
                className={inputCls}
                placeholder="연락처"
              />
            </Field>

            <Field label="반납예정일">
              <div className="space-y-2">
                <input
                  type="date"
                  value={editExpectedReturn}
                  onChange={e => setEditExpectedReturn(e.target.value)}
                  className={inputCls}
                  disabled={editReturnUndecided}
                />
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editReturnUndecided}
                    onChange={e => {
                      setEditReturnUndecided(e.target.checked)
                      if (e.target.checked) {
                        setEditExpectedReturn('')
                      }
                    }}
                    className="w-4 h-4 rounded border-slate-300 text-blue-500 focus:ring-2 focus:ring-blue-200 cursor-pointer"
                  />
                  <span className="text-sm text-slate-600">미정</span>
                </label>
              </div>
            </Field>

            {/* 기존 품목 수정 섹션 */}
            <div className="border-t border-slate-200 pt-3 mt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-slate-700">기존 품목 ({editingGroup.items.length}개)</span>
                <span className="text-xs text-slate-500">수정 버튼을 눌러 품목을 교체하세요</span>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {editingGroup.items.map((rental) => {
                  const isEditing = !!editingItems[rental.id]
                  const editData = editingItems[rental.id]

                  // 수정 모드일 때 사용할 IP 목록
                  const availableIPs = isEditing ? allItems.filter(i =>
                    i.status === '데모' &&
                    i.item_name === editData.item_name &&
                    i.ip && i.ip.trim()
                  ) : []
                  const uniqueNames = [...new Set(allItems.filter(i => i.status === '데모').map(i => i.item_name))]

                  return (
                    <div key={rental.id} className={`p-2 rounded border ${isEditing ? 'bg-yellow-50 border-yellow-300' : 'bg-slate-50 border-slate-200'}`}>
                      {isEditing ? (
                        // 수정 모드
                        <div className="space-y-2">
                          <div className="grid grid-cols-12 gap-2">
                            {/* 품명 */}
                            <div className="col-span-4">
                              <label className="block text-xs text-slate-500 mb-1">품명</label>
                              <input
                                type="text"
                                list={`edit-item-names-${rental.id}`}
                                value={editData.item_name}
                                onChange={e => handleEditItemName(rental.id, e.target.value)}
                                className="w-full px-2 py-1 text-xs border border-yellow-400 rounded bg-white"
                              />
                              <datalist id={`edit-item-names-${rental.id}`}>
                                {uniqueNames.slice(0, 20).map((name, i) => (
                                  <option key={i} value={name} />
                                ))}
                              </datalist>
                            </div>

                            {/* IP/장비 선택 */}
                            <div className="col-span-3">
                              <label className="block text-xs text-slate-500 mb-1">IP (교체)</label>
                              <select
                                value={editData.item_id || ''}
                                onChange={e => {
                                  const selectedId = parseInt(e.target.value)
                                  const selectedItem = allItems.find(i => i.id === selectedId)
                                  if (selectedItem) {
                                    handleEditItemIP(rental.id, selectedItem)
                                  }
                                }}
                                className="w-full px-2 py-1 text-xs border border-yellow-400 rounded bg-white"
                              >
                                <option value="">장비 선택</option>
                                {availableIPs.map(i => (
                                  <option key={i.id} value={i.id}>{i.ip}</option>
                                ))}
                              </select>
                            </div>

                            {/* 수량 */}
                            <div className="col-span-2">
                              <label className="block text-xs text-slate-500 mb-1">수량</label>
                              <input
                                type="number"
                                min="1"
                                value={editData.quantity}
                                onChange={e => updateEditingItem(rental.id, 'quantity', parseInt(e.target.value) || 1)}
                                className="w-full px-2 py-1 text-xs border border-yellow-400 rounded text-center bg-white"
                              />
                            </div>

                            {/* 버튼들 */}
                            <div className="col-span-3 flex items-end gap-1">
                              <button
                                type="button"
                                onClick={() => cancelEditItem(rental.id)}
                                style={{ flex: 1, padding: '4px 8px', fontSize: '12px', backgroundColor: '#e2e8f0', color: '#475569', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
                              >
                                취소
                              </button>
                            </div>
                          </div>
                          {/* 변경 내용 미리보기 */}
                          {(editData.item_id !== rental.item_id || editData.item_name !== (rental.item_name || '')) && (
                            <div className="text-xs text-yellow-700 bg-yellow-100 px-2 py-1 rounded">
                              변경: {rental.item_name || '-'} ({rental.ip || rental.serial || '-'}) → {editData.item_name} ({editData.item_id ? allItems.find(i => i.id === editData.item_id)?.ip || '-' : '미지정'})
                            </div>
                          )}
                        </div>
                      ) : (
                        // 보기 모드
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="text-sm font-medium text-slate-700">
                              {rental.item_name || '-'}
                              {rental.returned_at && <span className="ml-2 text-xs text-green-600">(반납완료)</span>}
                            </div>
                            <div className="text-xs text-slate-500">
                              {rental.ip || rental.serial || rental.description || '-'} / 수량: {rental.quantity || 1}
                            </div>
                          </div>
                          {!rental.returned_at && (
                            <button
                              type="button"
                              onClick={() => startEditItem(rental)}
                              style={{ backgroundColor: '#f59e0b', color: 'white', padding: '4px 8px', fontSize: '12px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px', border: 'none', cursor: 'pointer' }}
                            >
                              <Edit2 size={12}/> 수정
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 품목 추가 섹션 */}
            <div className="border-t border-slate-200 pt-3 mt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-slate-700">품목 추가</span>
                <button
                  type="button"
                  onClick={addNewItem}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                >
                  <Plus size={12}/> 추가
                </button>
              </div>

              {newItems.length > 0 && (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {newItems.map((item, idx) => {
                    // 현재 품명에 맞는 데모 아이템들 (IP가 있는 것만)
                    const availableIPs = allItems.filter(i =>
                      i.status === '데모' &&
                      i.item_name === item.item_name &&
                      i.ip && i.ip.trim()
                    )
                    // 품명 목록 (중복 제거)
                    const uniqueNames = [...new Set(allItems.filter(i => i.status === '데모').map(i => i.item_name))]

                    return (
                      <div key={idx} className="p-2 bg-slate-50 rounded border border-slate-200">
                        <div className="grid grid-cols-12 gap-2">
                          {/* 품명 */}
                          <div className="col-span-4">
                            <input
                              type="text"
                              list={`item-names-${idx}`}
                              value={item.item_name}
                              onChange={e => handleSelectItemName(idx, e.target.value)}
                              placeholder="품명"
                              className="w-full px-2 py-1 text-xs border border-slate-300 rounded"
                            />
                            <datalist id={`item-names-${idx}`}>
                              {uniqueNames.slice(0, 20).map((name, i) => (
                                <option key={i} value={name} />
                              ))}
                            </datalist>
                          </div>

                          {/* IP 선택 */}
                          <div className="col-span-3">
                            <select
                              value={item.item_id || ''}
                              onChange={e => {
                                const selectedId = parseInt(e.target.value)
                                const selectedItem = allItems.find(i => i.id === selectedId)
                                if (selectedItem) {
                                  handleSelectIP(idx, selectedItem)
                                }
                              }}
                              className="w-full px-2 py-1 text-xs border border-slate-300 rounded"
                            >
                              <option value="">IP 선택</option>
                              {availableIPs.map(i => (
                                <option key={i.id} value={i.id}>{i.ip}</option>
                              ))}
                            </select>
                          </div>

                          {/* 수량 */}
                          <div className="col-span-2">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={e => updateNewItem(idx, 'quantity', e.target.value)}
                              placeholder="수량"
                              className="w-full px-2 py-1 text-xs border border-slate-300 rounded text-center"
                            />
                          </div>

                          {/* 비고 */}
                          <div className="col-span-2">
                            <input
                              type="text"
                              value={item.note}
                              onChange={e => updateNewItem(idx, 'note', e.target.value)}
                              placeholder="비고"
                              className="w-full px-2 py-1 text-xs border border-slate-300 rounded"
                            />
                          </div>

                          {/* 삭제 버튼 */}
                          <div className="col-span-1 flex items-center justify-center">
                            <button
                              type="button"
                              onClick={() => removeNewItem(idx)}
                              className="p-1 text-red-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 size={14}/>
                            </button>
                          </div>
                        </div>
                        {item.item_description && (
                          <div className="mt-1 text-xs text-slate-500 truncate">
                            규격: {item.item_description}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {newItems.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-2">
                  추가 버튼을 눌러 품목을 추가하세요
                </p>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* 대여증 출력 모달 */}
      {showReceipt && receiptData && (
        <EditableRentalReceipt data={receiptData} onClose={() => setShowReceipt(false)} />
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
              onClick={openReturnModal}
              className="flex items-center gap-2 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 rounded-full text-sm font-medium transition-colors"
            >
              <CheckCircle size={14}/> 반납처리
            </button>
            <button
              onClick={() => openExtendModal()}
              className="flex items-center gap-2 px-4 py-1.5 bg-blue-500 hover:bg-blue-600 rounded-full text-sm font-medium transition-colors"
            >
              <Calendar size={14}/> 연장처리
            </button>
            <button
              onClick={handlePrintSelectedReceipt}
              className="flex items-center gap-2 px-4 py-1.5 bg-purple-500 hover:bg-purple-600 rounded-full text-sm font-medium transition-colors"
            >
              <Printer size={14}/> 대여증
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
