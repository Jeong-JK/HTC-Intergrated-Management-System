import { useState, useEffect } from 'react'
import { Modal, Btn, fmt } from '../Common.jsx'
import { Search, Plus, Edit, Trash2, FileText, ArrowRight, Printer } from 'lucide-react'
import dayjs from 'dayjs'
import {
  getQuotations, deleteQuotation, updateQuotationStatus, quotationToPO
} from '../../api.js'

const STATUS_COLORS = {
  '작성중': 'bg-slate-100 text-slate-600',
  '발송': 'bg-blue-100 text-blue-600',
  '승인': 'bg-green-100 text-green-600',
  '거절': 'bg-red-100 text-red-600',
  '만료': 'bg-amber-100 text-amber-600'
}

export default function QuotationListModal({
  onClose,
  onNew,
  onEdit,
  onPrint,
  companyId = null
}) {
  const [quotations, setQuotations] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const loadQuotations = async () => {
    setLoading(true)
    try {
      const params = {}
      if (search) params.search = search
      if (statusFilter) params.status = statusFilter
      if (companyId) params.company_id = companyId

      const res = await getQuotations(params)
      setQuotations(res.data || [])
    } catch (e) {
      console.error('Failed to load quotations:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadQuotations()
  }, [search, statusFilter, companyId])

  const handleDelete = async (id) => {
    if (!confirm('이 견적서를 삭제하시겠습니까?')) return
    try {
      await deleteQuotation(id)
      loadQuotations()
    } catch (e) {
      alert(e.response?.data?.detail || '삭제 실패')
    }
  }

  const handleStatusChange = async (id, status) => {
    try {
      await updateQuotationStatus(id, { status })
      loadQuotations()
    } catch (e) {
      alert(e.response?.data?.detail || '상태 변경 실패')
    }
  }

  const handleConvertToPO = async (id) => {
    if (!confirm('이 견적서를 발주서로 변환하시겠습니까?')) return
    try {
      await quotationToPO(id)
      alert('발주서가 생성되었습니다')
      loadQuotations()
    } catch (e) {
      alert(e.response?.data?.detail || '변환 실패')
    }
  }

  return (
    <Modal
      title="견적서 목록"
      sub={`총 ${quotations.length}건`}
      onClose={onClose}
      size="xl"
      footer={
        <>
          <Btn onClick={onClose} className="flex-1 justify-center">닫기</Btn>
          <Btn onClick={onNew} variant="primary" className="flex-1 justify-center">
            <Plus size={14} /> 새 견적서
          </Btn>
        </>
      }
    >
      {/* 검색/필터 */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="견적번호 또는 회사명 검색"
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-400"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
        >
          <option value="">전체 상태</option>
          <option value="작성중">작성중</option>
          <option value="발송">발송</option>
          <option value="승인">승인</option>
          <option value="거절">거절</option>
          <option value="만료">만료</option>
        </select>
      </div>

      {/* 목록 */}
      <div className="border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold">견적번호</th>
              <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold">회사</th>
              <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold">담당자</th>
              <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold">견적일</th>
              <th className="px-4 py-3 text-right text-xs text-slate-500 font-semibold">금액</th>
              <th className="px-4 py-3 text-center text-xs text-slate-500 font-semibold">상태</th>
              <th className="px-4 py-3 text-center text-xs text-slate-500 font-semibold">작업</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-slate-400">불러오는 중...</td>
              </tr>
            ) : quotations.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-slate-400">견적서가 없습니다</td>
              </tr>
            ) : quotations.map(q => (
              <tr key={q.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <span className="font-mono text-blue-600">{q.quotation_no}</span>
                </td>
                <td className="px-4 py-3 font-medium">{q.company_name}</td>
                <td className="px-4 py-3 text-slate-600">{q.contact_name || '-'}</td>
                <td className="px-4 py-3 text-slate-500">
                  {q.quotation_date ? dayjs(q.quotation_date).format('YYYY-MM-DD') : '-'}
                </td>
                <td className="px-4 py-3 text-right font-medium">₩{fmt(q.total)}</td>
                <td className="px-4 py-3 text-center">
                  <select
                    value={q.status}
                    onChange={e => handleStatusChange(q.id, e.target.value)}
                    className={`text-xs px-2 py-1 rounded-md font-medium border-0 cursor-pointer ${STATUS_COLORS[q.status] || 'bg-slate-100'}`}
                  >
                    <option value="작성중">작성중</option>
                    <option value="발송">발송</option>
                    <option value="승인">승인</option>
                    <option value="거절">거절</option>
                    <option value="만료">만료</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 justify-center">
                    <button
                      onClick={() => onEdit(q.id)}
                      title="수정"
                      className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={() => onPrint(q.id)}
                      title="인쇄"
                      className="p-1.5 text-slate-400 hover:text-green-500 hover:bg-green-50 rounded transition-colors"
                    >
                      <Printer size={14} />
                    </button>
                    {q.status !== '승인' && (
                      <button
                        onClick={() => handleConvertToPO(q.id)}
                        title="발주서 변환"
                        className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded transition-colors"
                      >
                        <ArrowRight size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(q.id)}
                      title="삭제"
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}
