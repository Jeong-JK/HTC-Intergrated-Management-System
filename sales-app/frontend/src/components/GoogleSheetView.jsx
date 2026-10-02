import { useState, useEffect, useRef, useMemo } from 'react'
import { RefreshCw, ChevronUp, Edit2, Check, X } from 'lucide-react'
import axios from 'axios'

export default function GoogleSheetView({ sheetName, onSyncComplete }) {
  const [sheetData, setSheetData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState(null)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [editingCell, setEditingCell] = useState(null)
  const [editValue, setEditValue] = useState('')
  const tableContainerRef = useRef(null)

  // 병합 정보를 셀별 맵으로 변환
  const mergeMap = useMemo(() => {
    if (!sheetData?.merges) return {}

    const map = {}
    for (const merge of sheetData.merges) {
      const startRow = merge.startRowIndex
      const endRow = merge.endRowIndex
      const startCol = merge.startColumnIndex
      const endCol = merge.endColumnIndex

      const rowSpan = endRow - startRow
      const colSpan = endCol - startCol

      // 첫 번째 셀에 span 정보 저장
      const key = `${startRow}-${startCol}`
      map[key] = { rowSpan, colSpan, isStart: true }

      // 나머지 셀은 숨김 처리
      for (let r = startRow; r < endRow; r++) {
        for (let c = startCol; c < endCol; c++) {
          if (r !== startRow || c !== startCol) {
            map[`${r}-${c}`] = { hidden: true }
          }
        }
      }
    }
    return map
  }, [sheetData?.merges])

  useEffect(() => {
    loadSheetData()
  }, [sheetName])

  const loadSheetData = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await axios.get(`/api/sheets/${encodeURIComponent(sheetName)}`)
      setSheetData(res.data)
    } catch (err) {
      console.error('시트 데이터 로딩 실패:', err)
      if (err.response?.status === 404) {
        setError('시트 데이터가 없습니다. 동기화를 먼저 실행하세요.')
      } else {
        setError(err.response?.data?.detail || '데이터 로딩 실패')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async () => {
    try {
      setSyncing(true)
      setError(null)
      await axios.post(`/api/sheets/sync/${encodeURIComponent(sheetName)}`)
      await loadSheetData()
      onSyncComplete?.()
    } catch (err) {
      console.error('동기화 실패:', err)
      setError(err.response?.data?.detail || '동기화 실패')
    } finally {
      setSyncing(false)
    }
  }

  const scrollToTop = () => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleCellDoubleClick = (rowIdx, colIdx, currentValue) => {
    setEditingCell({ rowIdx, colIdx })
    setEditValue(currentValue || '')
  }

  const handleCellSave = async () => {
    if (!editingCell) return

    try {
      const { rowIdx, colIdx } = editingCell
      // 구글 시트는 1-indexed
      await axios.put(`/api/sheets/${encodeURIComponent(sheetName)}/cell`, {
        row: rowIdx + 1,
        col: colIdx + 1,
        value: editValue
      })
      // 로컬 데이터 업데이트
      const newData = { ...sheetData }
      newData.data[rowIdx][colIdx] = editValue
      setSheetData(newData)
      setEditingCell(null)
    } catch (err) {
      console.error('셀 수정 실패:', err)
      const detail = err.response?.data?.detail
      const msg = typeof detail === 'object' ? JSON.stringify(detail) : (detail || err.message || '수정 실패')
      alert(msg)
    }
  }

  const handleCellCancel = () => {
    setEditingCell(null)
    setEditValue('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleCellSave()
    } else if (e.key === 'Escape') {
      handleCellCancel()
    }
  }

  // 셀 배경색 결정 (구글 시트처럼 행 단위로 구분)
  const getCellBgClass = (rowIdx) => {
    if (rowIdx === 0) return 'bg-slate-100' // 헤더 행
    return rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="animate-spin text-green-600 mr-2" size={20} />
        <span className="text-slate-500">로딩 중...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-500 mb-4">{error}</div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 mx-auto">
          <RefreshCw className={syncing ? 'animate-spin' : ''} size={16} />
          {syncing ? '동기화 중...' : '구글시트에서 동기화'}
        </button>
      </div>
    )
  }

  if (!sheetData || !sheetData.data) {
    return <div className="text-center py-12 text-slate-500">데이터가 없습니다</div>
  }

  const rows = sheetData.data

  return (
    <div className="space-y-3">
      {/* 상단 정보 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="font-semibold text-slate-800">{sheetName}</h3>
          <span className="text-sm text-slate-500">
            {sheetData.row_count}행 × {sheetData.col_count}열
          </span>
          <span className="text-xs text-slate-400">
            마지막 동기화: {sheetData.synced_at ? new Date(sheetData.synced_at).toLocaleString('ko-KR') : '-'}
          </span>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
          <RefreshCw className={syncing ? 'animate-spin' : ''} size={16} />
          {syncing ? '동기화 중...' : '동기화'}
        </button>
      </div>

      {/* 테이블 */}
      <div className="border border-slate-300 rounded-lg overflow-hidden shadow-sm">
        <div
          ref={tableContainerRef}
          className="overflow-auto"
          style={{ maxHeight: 'calc(100vh - 280px)' }}
          onScroll={(e) => setShowScrollTop(e.target.scrollTop > 200)}
        >
          <table className="min-w-max text-xs border-collapse">
            <tbody>
              {rows.map((row, rowIdx) => (
                <tr key={rowIdx} className={rowIdx === 0 ? 'sticky top-0 z-10' : ''}>
                  {/* 행 번호 */}
                  <td className="px-2 py-1 text-center text-slate-400 bg-slate-100 border-r border-b border-slate-300 w-10 font-mono text-[10px]">
                    {rowIdx + 1}
                  </td>
                  {row.map((cell, colIdx) => {
                    const cellKey = `${rowIdx}-${colIdx}`
                    const mergeInfo = mergeMap[cellKey]

                    // 병합된 셀의 일부 (숨김 처리)
                    if (mergeInfo?.hidden) {
                      return null
                    }

                    return (
                      <td
                        key={colIdx}
                        rowSpan={mergeInfo?.rowSpan || 1}
                        colSpan={mergeInfo?.colSpan || 1}
                        className={`px-2 py-1 border-r border-b border-slate-200 min-w-[60px] max-w-[300px] cursor-pointer hover:bg-blue-50 ${getCellBgClass(rowIdx)} ${rowIdx === 0 ? 'font-semibold text-slate-700' : 'text-slate-600'} ${mergeInfo?.rowSpan > 1 || mergeInfo?.colSpan > 1 ? 'align-top' : ''}`}
                        onDoubleClick={() => handleCellDoubleClick(rowIdx, colIdx, cell)}
                        title={cell}
                        style={{
                          whiteSpace: mergeInfo?.rowSpan > 1 ? 'pre-wrap' : 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {editingCell?.rowIdx === rowIdx && editingCell?.colIdx === colIdx ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={handleKeyDown}
                              autoFocus
                              className="w-full px-1 py-0.5 border border-blue-500 rounded text-xs"
                            />
                            <button onClick={handleCellSave} className="text-green-600 hover:text-green-800">
                              <Check size={14} />
                            </button>
                            <button onClick={handleCellCancel} className="text-red-600 hover:text-red-800">
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          cell
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
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
        총 {rows.length}행
      </div>
    </div>
  )
}
