import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, MessageSquare, Home } from 'lucide-react'
import { getPosts, createPost, updatePost, deletePost } from '../api'
import axios from 'axios'

export default function BoardPage() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showWriteForm, setShowWriteForm] = useState(false)
  const [editingPost, setEditingPost] = useState(null)
  const [formData, setFormData] = useState({
    title: '',
    content: ''
  })
  const [accessChecked, setAccessChecked] = useState(false)

  const goToMainHub = () => {
    const protocol = window.location.protocol
    const hostname = window.location.hostname
    // 도메인 환경: ims.hltac.com, 로컬 환경: 포트 사용
    if (hostname.includes('hltac.com')) {
      window.location.href = `${protocol}//ims.hltac.com`
    } else {
      window.location.href = `${protocol}//${hostname}:8000`
    }
  }

  // 접근 권한 체크 (미들웨어에서 이미 권한 체크함, API 성공=권한있음)
  useEffect(() => {
    const checkAccess = async () => {
      try {
        await axios.get('/api/auth/me')
        setAccessChecked(true)
      } catch (err) {
        if (err.response?.status === 403) {
          alert('권한이 없습니다. 관리자에게 문의하세요.')
        }
        goToMainHub()
      }
    }
    checkAccess()
  }, [])

  useEffect(() => {
    if (accessChecked) {
      loadPosts()
    }
  }, [accessChecked])

  const loadPosts = async () => {
    try {
      setLoading(true)
      const res = await getPosts()
      setPosts(res.data || [])
    } catch (error) {
      console.error('게시글 로딩 실패:', error)
      alert('게시글을 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.title.trim() || !formData.content.trim()) {
      alert('제목과 내용을 입력해주세요')
      return
    }

    try {
      if (editingPost) {
        await updatePost(editingPost.id, {
          title: formData.title,
          content: formData.content
        })
        alert('게시글이 수정되었습니다')
      } else {
        await createPost(formData)
        alert('게시글이 작성되었습니다')
      }

      setFormData({ title: '', content: '' })
      setShowWriteForm(false)
      setEditingPost(null)
      loadPosts()
    } catch (error) {
      console.error('게시글 저장 실패:', error)
      alert('게시글 저장에 실패했습니다')
    }
  }

  const handleEdit = (post) => {
    setEditingPost(post)
    setFormData({
      title: post.title,
      content: post.content
    })
    setShowWriteForm(true)
  }

  const handleDelete = async (postId) => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    try {
      await deletePost(postId)
      alert('게시글이 삭제되었습니다')
      loadPosts()
    } catch (error) {
      console.error('게시글 삭제 실패:', error)
      alert('게시글 삭제에 실패했습니다')
    }
  }

  const handleCancel = () => {
    setFormData({ title: '', content: '' })
    setShowWriteForm(false)
    setEditingPost(null)
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now - date
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 60) return `${minutes}분 전`
    if (hours < 24) return `${hours}시간 전`
    if (days < 7) return `${days}일 전`

    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const goBack = () => {
    window.close()
    // 만약 window.close()가 작동하지 않으면 (새 탭이 아닌 경우)
    setTimeout(() => {
      window.location.href = '/'
    }, 100)
  }

  // 권한 체크 전에는 빈 화면
  if (!accessChecked) {
    return <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50" />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <div className="max-w-5xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={goBack}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50 transition-colors">
              <Home size={16}/>
              돌아가기
            </button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-blue-500 rounded-xl flex items-center justify-center shadow-lg">
                <MessageSquare size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">Sales Dashboard</h1>
                <p className="text-sm text-slate-500"></p>
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          {loading ? (
            <div className="text-center py-12 text-slate-500">로딩 중...</div>
          ) : showWriteForm ? (
            /* 글쓰기 폼 */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  제목 *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="제목을 입력하세요"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  내용 *
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 min-h-[200px]"
                  placeholder="내용을 입력하세요"
                  required
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors">
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                  {editingPost ? '수정' : '글쓰기'}
                </button>
              </div>
            </form>
          ) : (
            /* 게시글 목록 */
            <>
              <div className="flex justify-between items-center mb-4">
                <div className="text-sm text-slate-600">
                  총 <span className="font-semibold text-green-600">{posts.length}</span>개의 게시글
                </div>
                <button
                  onClick={() => setShowWriteForm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                  <Plus size={18} />
                  글쓰기
                </button>
              </div>

              {posts.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <MessageSquare size={48} className="mx-auto mb-3 opacity-30" />
                  <p>아직 게시글이 없습니다</p>
                  <p className="text-sm mt-1">첫 게시글을 작성해보세요!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {posts.map((post) => (
                    <div
                      key={post.id}
                      className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-lg font-semibold text-slate-800 flex-1">
                          {post.title}
                        </h3>
                        <div className="flex gap-1 ml-2">
                          <button
                            onClick={() => handleEdit(post)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="수정">
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(post.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="삭제">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      <p className="text-slate-600 text-sm mb-3 whitespace-pre-wrap">
                        {post.content}
                      </p>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="font-medium text-green-600">{post.author}</span>
                        <span>{formatDate(post.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
