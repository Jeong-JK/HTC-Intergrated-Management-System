import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload, Download, Trash2, HardDrive, File, RefreshCw, Pencil } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

export default function AdminDrive() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [files, setFiles] = useState([])
  const [storage, setStorage] = useState({ used: 0, max: 0, percent: 0 })
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef(null)

  // Admin 체크
  useEffect(() => {
    if (user && !user.is_admin) {
      navigate('/')
    }
  }, [user, navigate])

  // 파일 목록 로드
  const loadFiles = async () => {
    try {
      const res = await fetch('/api/drive/files', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setFiles(data.files)
        setStorage(data.storage)
      }
    } catch (err) {
      console.error('파일 목록 로드 실패:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFiles()
  }, [])

  // 파일 업로드
  const handleUpload = async (fileList) => {
    if (!fileList || fileList.length === 0) return

    setUploading(true)
    try {
      for (const file of fileList) {
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch('/api/drive/upload', {
          method: 'POST',
          credentials: 'include',
          body: formData
        })

        if (!res.ok) {
          const err = await res.json()
          alert(err.detail || '업로드 실패')
        }
      }
      loadFiles()
    } catch (err) {
      console.error('업로드 오류:', err)
      alert('업로드 중 오류가 발생했습니다')
    } finally {
      setUploading(false)
    }
  }

  // 파일 다운로드
  const handleDownload = (filename) => {
    window.location.href = `/api/drive/download/${encodeURIComponent(filename)}`
  }

  // 파일 삭제
  const handleDelete = async (filename) => {
    if (!confirm(`"${filename}" 파일을 삭제하시겠습니까?`)) return

    try {
      const res = await fetch(`/api/drive/delete/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (res.ok) {
        loadFiles()
      } else {
        const err = await res.json()
        alert(err.detail || '삭제 실패')
      }
    } catch (err) {
      console.error('삭제 오류:', err)
      alert('삭제 중 오류가 발생했습니다')
    }
  }

  // 파일 이름 변경
  const handleRename = async (filename) => {
    const newName = prompt('새 파일명을 입력하세요:', filename)
    if (!newName || newName === filename) return

    try {
      const res = await fetch(`/api/drive/rename/${encodeURIComponent(filename)}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_name: newName })
      })

      if (res.ok) {
        loadFiles()
      } else {
        const err = await res.json()
        alert(err.detail || '이름 변경 실패')
      }
    } catch (err) {
      console.error('이름 변경 오류:', err)
      alert('이름 변경 중 오류가 발생했습니다')
    }
  }

  // 드래그 앤 드롭
  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files)
    }
  }

  if (!user?.is_admin) {
    return null
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* 헤더 */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} className="text-slate-600" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <HardDrive size={22} className="text-amber-600" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-800">Admin Drive</h1>
                <p className="text-xs text-slate-500">관리자 전용 파일 저장소</p>
              </div>
            </div>
          </div>

          {/* 용량 표시 */}
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-slate-500">사용량</p>
              <p className="text-sm font-semibold text-slate-700">
                {storage.used_display} / {storage.max_display}
              </p>
            </div>
            <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all"
                style={{ width: `${Math.min(storage.percent, 100)}%` }}
              />
            </div>
            <span className="text-xs text-slate-500 w-12">{storage.percent}%</span>
          </div>
        </div>
      </div>

      {/* 메인 */}
      <div className="max-w-4xl mx-auto p-6">
        {/* 업로드 영역 */}
        <div
          className={`mb-6 border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            dragActive
              ? 'border-amber-400 bg-amber-50'
              : 'border-slate-300 bg-white hover:border-slate-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />

          <Upload size={32} className="mx-auto text-slate-400 mb-3" />
          <p className="text-slate-600 mb-2">
            파일을 드래그하거나{' '}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-amber-600 hover:text-amber-700 font-medium"
              disabled={uploading}
            >
              클릭하여 업로드
            </button>
          </p>
          <p className="text-xs text-slate-400">최대 1GB까지 저장 가능</p>

          {uploading && (
            <div className="mt-4 flex items-center justify-center gap-2 text-amber-600">
              <RefreshCw size={16} className="animate-spin" />
              <span className="text-sm">업로드 중...</span>
            </div>
          )}
        </div>

        {/* 파일 목록 */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              파일 목록 ({files.length}개)
            </h2>
            <button
              onClick={loadFiles}
              className="p-1.5 hover:bg-slate-200 rounded transition-colors"
              title="새로고침"
            >
              <RefreshCw size={16} className="text-slate-500" />
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-500">
              <RefreshCw size={24} className="mx-auto animate-spin mb-2" />
              <p className="text-sm">로딩 중...</p>
            </div>
          ) : files.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <File size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">업로드된 파일이 없습니다</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-slate-100">
                  <th className="text-left px-4 py-2 font-medium">파일명</th>
                  <th className="text-right px-4 py-2 font-medium w-24">크기</th>
                  <th className="text-right px-4 py-2 font-medium w-36">업로드일</th>
                  <th className="text-center px-4 py-2 font-medium w-32">작업</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.name} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <File size={16} className="text-slate-400 flex-shrink-0" />
                        <span className="text-sm text-slate-700 truncate">{file.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-slate-500">
                      {file.size_display}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-slate-500">
                      {file.uploaded_at}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleDownload(file.name)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="다운로드"
                        >
                          <Download size={16} />
                        </button>
                        <button
                          onClick={() => handleRename(file.name)}
                          className="p-1.5 text-amber-600 hover:bg-amber-50 rounded transition-colors"
                          title="이름 변경"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(file.name)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="삭제"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
