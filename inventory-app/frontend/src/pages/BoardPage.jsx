import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Edit2, Trash2, MessageSquare, ArrowLeft, User, X, Send, Bell } from 'lucide-react'
import { getPosts, createPost, updatePost, deletePost, markPostAsRead, getComments, createComment, updateComment, deleteComment, getCommentNotifications, getUnreadCommentNotificationCount, markNotificationAsRead, markAllNotificationsAsRead, deleteReadNotifications } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'

export default function BoardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showWriteForm, setShowWriteForm] = useState(false)
  const [editingPost, setEditingPost] = useState(null)
  const [viewingPost, setViewingPost] = useState(null)
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    is_notice: false
  })
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')
  const [editingComment, setEditingComment] = useState(null)
  const [replyingTo, setReplyingTo] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)

  useEffect(() => {
    loadPosts()
    loadUnreadNotificationCount()
    const interval = setInterval(loadUnreadNotificationCount, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadUnreadNotificationCount = async () => {
    try {
      const res = await getUnreadCommentNotificationCount()
      setUnreadNotificationCount(res.data.unread_count || 0)
    } catch (error) {
      console.error('알림 개수 로딩 실패:', error)
    }
  }

  const loadNotifications = async () => {
    try {
      const res = await getCommentNotifications()
      setNotifications(res.data.data || [])
    } catch (error) {
      console.error('알림 로딩 실패:', error)
    }
  }

  const handleOpenNotifications = () => {
    setShowNotifications(true)
    loadNotifications()
  }

  const handleNotificationClick = async (notification) => {
    // 읽음 처리
    if (!notification.is_read) {
      try {
        await markNotificationAsRead(notification.id)
        setUnreadNotificationCount(prev => Math.max(0, prev - 1))
        setNotifications(notifications.map(n =>
          n.id === notification.id ? { ...n, is_read: 1 } : n
        ))
      } catch (error) {
        console.error('읽음 처리 실패:', error)
      }
    }

    // 해당 게시글 열기
    const post = posts.find(p => p.id === notification.post_id)
    if (post) {
      setShowNotifications(false)
      handleViewPost(post)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead()
      setUnreadNotificationCount(0)
      setNotifications(notifications.map(n => ({ ...n, is_read: 1 })))
    } catch (error) {
      console.error('모두 읽음 처리 실패:', error)
    }
  }

  const handleDeleteReadNotifications = async () => {
    try {
      const res = await deleteReadNotifications()
      // 읽은 알림 목록에서 제거
      setNotifications(notifications.filter(n => !n.is_read))
      alert(res.data.message || '읽은 알림이 삭제되었습니다')
    } catch (error) {
      console.error('읽은 알림 삭제 실패:', error)
    }
  }

  const loadPosts = async () => {
    try {
      setLoading(true)
      const res = await getPosts()
      setPosts(res.data.data || [])
      const target = (res.data.data || []).find(p => p.id === Number(new URLSearchParams(window.location.search).get('post'))) // 활동 로그 '화면 열기'
      if (target) { window.history.replaceState(null, '', window.location.pathname); handleViewPost(target) }
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
      alert(error.response?.data?.detail || '게시글 저장에 실패했습니다')
    }
  }

  const handleEdit = (post) => {
    // Only allow editing own posts or admin
    if (post.user_id !== user?.id && !user?.is_admin) {
      alert('본인의 게시글만 수정할 수 있습니다')
      return
    }

    setEditingPost(post)
    setFormData({
      title: post.title,
      content: post.content,
      is_notice: post.is_notice || false
    })
    setShowWriteForm(true)
  }

  const handleDelete = async (post) => {
    // Only allow deleting own posts or admin
    if (post.user_id !== user?.id && !user?.is_admin) {
      alert('본인의 게시글만 삭제할 수 있습니다')
      return
    }

    if (!confirm('정말 삭제하시겠습니까?')) return

    try {
      await deletePost(post.id)
      alert('게시글이 삭제되었습니다')
      loadPosts()
    } catch (error) {
      console.error('게시글 삭제 실패:', error)
      alert(error.response?.data?.detail || '게시글 삭제에 실패했습니다')
    }
  }

  const handleCancel = () => {
    setFormData({ title: '', content: '', is_notice: false })
    setShowWriteForm(false)
    setEditingPost(null)
  }

  const handleViewPost = async (post) => {
    setViewingPost(post)
    setCommentText('')
    setEditingComment(null)

    // Load comments
    try {
      const res = await getComments(post.id)
      setComments(res.data.data || [])
    } catch (error) {
      console.error('댓글 로딩 실패:', error)
    }

    // Mark as read if not already read
    if (!post.is_read) {
      try {
        await markPostAsRead(post.id)
        // Update local state
        setPosts(posts.map(p => p.id === post.id ? { ...p, is_read: 1 } : p))
      } catch (error) {
        console.error('읽음 처리 실패:', error)
      }
    }
  }

  const handleCloseView = () => {
    setViewingPost(null)
    setComments([])
    setCommentText('')
    setEditingComment(null)
    setReplyingTo(null)
  }

  const handleCommentSubmit = async (e) => {
    e.preventDefault()

    if (!commentText.trim()) {
      alert('댓글 내용을 입력해주세요')
      return
    }

    try {
      if (editingComment) {
        await updateComment(viewingPost.id, editingComment.id, { content: commentText })
        alert('댓글이 수정되었습니다')
      } else {
        await createComment(viewingPost.id, {
          content: commentText,
          parent_comment_id: replyingTo?.id || null
        })
        alert(replyingTo ? '답글이 작성되었습니다' : '댓글이 작성되었습니다')
      }

      setCommentText('')
      setEditingComment(null)
      setReplyingTo(null)

      // Reload comments
      const res = await getComments(viewingPost.id)
      setComments(res.data.data || [])
    } catch (error) {
      console.error('댓글 저장 실패:', error)
      alert(error.response?.data?.detail || '댓글 저장에 실패했습니다')
    }
  }

  const handleEditComment = (comment) => {
    setEditingComment(comment)
    setCommentText(comment.content)
  }

  const handleCancelEditComment = () => {
    setEditingComment(null)
    setReplyingTo(null)
    setCommentText('')
  }

  const handleReply = (comment) => {
    setReplyingTo(comment)
    setEditingComment(null)
    setCommentText('')
  }

  const handleDeleteComment = async (comment) => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    try {
      await deleteComment(viewingPost.id, comment.id)
      alert('댓글이 삭제되었습니다')

      // Reload comments
      const res = await getComments(viewingPost.id)
      setComments(res.data.data || [])
    } catch (error) {
      console.error('댓글 삭제 실패:', error)
      alert(error.response?.data?.detail || '댓글 삭제에 실패했습니다')
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    // DB에서 UTC로 저장된 시간을 올바르게 파싱
    const utcDateStr = dateStr.replace(' ', 'T') + (dateStr.includes('Z') ? '' : 'Z')
    const date = new Date(utcDateStr)
    const now = new Date()
    const diff = now - date
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return '방금 전'
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  window.close()
                  // 만약 window.close()가 작동하지 않으면 (새 탭이 아닌 경우)
                  setTimeout(() => {
                    navigate('/')
                  }, 100)
                }}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ArrowLeft size={20} className="text-slate-600" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
                  <MessageSquare size={24} className="text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-800">게시판</h1>
                  <p className="text-sm text-slate-500">팀 정보 공유 및 소통</p>
                </div>
              </div>
            </div>

            {/* 댓글 알림 버튼 */}
            <button
              onClick={handleOpenNotifications}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                backgroundColor: unreadNotificationCount > 0 ? '#fef2f2' : '#f8fafc',
                border: unreadNotificationCount > 0 ? '1px solid #fecaca' : '1px solid #e2e8f0',
                color: unreadNotificationCount > 0 ? '#dc2626' : '#64748b',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <Bell size={18} />
              <span>댓글 알림</span>
              {unreadNotificationCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-6px',
                  right: '-6px',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: '700',
                  borderRadius: '9999px',
                  minWidth: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 6px'
                }}>
                  {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="max-w-5xl mx-auto px-6 py-8">
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
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[200px]"
                  placeholder="내용을 입력하세요"
                  required
                />
              </div>
              {user?.is_admin && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_notice"
                    checked={formData.is_notice}
                    onChange={(e) => setFormData({ ...formData, is_notice: e.target.checked })}
                    className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                  />
                  <label htmlFor="is_notice" className="text-sm font-medium text-red-600">
                    📌 공지사항으로 등록
                  </label>
                </div>
              )}
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors">
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  {editingPost ? '수정하기' : '작성하기'}
                </button>
              </div>
            </form>
          ) : (
            /* 게시글 목록 */
            <>
              <div className="flex justify-between items-center mb-4">
                <div className="text-sm text-slate-600">
                  총 <span className="font-semibold text-blue-600">{posts.length}</span>개의 게시글
                </div>
                <button
                  onClick={() => setShowWriteForm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
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
                      onClick={() => handleViewPost(post)}
                      className={`rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer ${
                        post.is_notice
                          ? 'bg-amber-50 border-2 border-amber-300'
                          : 'bg-white border border-slate-200'
                      }`}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2 flex-1">
                          {post.is_notice && (
                            <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded">📌 공지</span>
                          )}
                          <h3 className={`text-lg ${!post.is_read ? 'font-bold' : 'font-semibold'} ${post.is_notice ? 'text-red-700' : 'text-slate-800'}`}>
                            {post.title}
                          </h3>
                          {!post.is_read && (
                            <span className="px-2 py-0.5 bg-blue-500 text-white text-xs font-bold rounded-full">NEW</span>
                          )}
                        </div>
                        {(post.user_id === user?.id || user?.is_admin) && (
                          <div className="flex gap-1 ml-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleEdit(post); }}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="수정">
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(post); }}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="삭제">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                      <p className="text-slate-600 text-sm mb-3 whitespace-pre-wrap line-clamp-2">
                        {post.content}
                      </p>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <div className="flex items-center gap-2">
                          <User size={14} className="text-slate-400" />
                          <span className="font-medium text-blue-600">{post.author_name}</span>
                          {post.author_position && (
                            <span className="text-slate-400">· {post.author_position}</span>
                          )}
                        </div>
                        <span>{formatDate(post.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* 상세보기 모달 */}
      {viewingPost && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">{viewingPost.title}</h2>
              <button
                onClick={handleCloseView}
                className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            <div className="px-6 py-4">
              <div className="flex items-center gap-2 mb-4 pb-4 border-b border-slate-200">
                <User size={16} className="text-slate-400" />
                <span className="font-medium text-blue-600">{viewingPost.author_name}</span>
                {viewingPost.author_position && (
                  <span className="text-slate-400">· {viewingPost.author_position}</span>
                )}
                <span className="text-slate-400 ml-auto text-sm">{formatDate(viewingPost.created_at)}</span>
              </div>

              <div className="prose max-w-none">
                <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {viewingPost.content}
                </p>
              </div>

              {/* 댓글 섹션 */}
              <div className="mt-6 pt-6 border-t border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">
                  댓글 <span className="text-blue-600">({comments.length})</span>
                </h3>

                {/* 댓글 목록 */}
                <div className="space-y-2 mb-4">
                  {comments.length === 0 ? (
                    <p className="text-center py-8 text-slate-400 text-sm">첫 댓글을 작성해보세요</p>
                  ) : (
                    comments.map((comment) => {
                      // 답글인 경우 원 댓글 찾기 (타입 안전하게 비교)
                      const parentComment = comment.parent_comment_id
                        ? comments.find(c => Number(c.id) === Number(comment.parent_comment_id))
                        : null

                      return (
                        <div
                          key={comment.id}
                          className={`rounded-lg p-4 ${comment.parent_comment_id ? 'bg-blue-50/70 border-l-4 border-blue-400' : 'bg-slate-50'}`}
                        >
                          {/* 답글인 경우 원 댓글 표시 */}
                          {comment.parent_comment_id && (
                            <div className="mb-2 pb-2 border-b border-blue-200">
                              <div className="flex items-center gap-1 text-xs text-blue-600">
                                <span>↳</span>
                                {parentComment ? (
                                  <>
                                    <span className="font-semibold">{parentComment.author_name}</span>
                                    <span className="text-blue-400">님에게 답글</span>
                                  </>
                                ) : (
                                  <span className="text-blue-400">답글</span>
                                )}
                              </div>
                              {parentComment && (
                                <p className="text-xs text-slate-500 mt-1 line-clamp-1 italic">
                                  "{parentComment.content}"
                                </p>
                              )}
                            </div>
                          )}
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <User size={14} className="text-slate-400" />
                              <span className="font-medium text-blue-600 text-sm">{comment.author_name}</span>
                              {comment.author_position && (
                                <span className="text-slate-400 text-xs">· {comment.author_position}</span>
                              )}
                              <span className="text-slate-400 text-xs">
                                {formatDate(comment.created_at)}
                              </span>
                            </div>
                            <div className="flex gap-1">
                              {!comment.parent_comment_id && (
                                <button
                                  onClick={() => handleReply(comment)}
                                  className="px-2 py-1 text-blue-600 hover:bg-blue-100 rounded text-xs transition-colors"
                                  title="답글"
                                >
                                  답글
                                </button>
                              )}
                              {(comment.user_id === user?.id || user?.is_admin) && (
                                <>
                                  <button
                                    onClick={() => handleEditComment(comment)}
                                    className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                                    title="수정"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteComment(comment)}
                                    className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                                    title="삭제"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                          <p className="text-slate-700 text-sm whitespace-pre-wrap">{comment.content}</p>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* 댓글 작성 폼 */}
                <div>
                  {replyingTo && (
                    <div className="mb-2 p-2 bg-blue-50 border-l-2 border-blue-500 rounded text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-blue-700">
                          <span className="font-medium">{replyingTo.author_name}</span>님에게 답글 작성 중
                        </span>
                        <button
                          onClick={() => setReplyingTo(null)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <X size={16} />
                        </button>
                      </div>
                      <p className="text-slate-600 text-xs mt-1 line-clamp-1">{replyingTo.content}</p>
                    </div>
                  )}
                  <form onSubmit={handleCommentSubmit} className="flex gap-2">
                    <input
                      type="text"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder={editingComment ? "댓글 수정..." : replyingTo ? "답글을 입력하세요..." : "댓글을 입력하세요..."}
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {(editingComment || replyingTo) && (
                      <button
                        type="button"
                        onClick={handleCancelEditComment}
                        className="px-4 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        취소
                      </button>
                    )}
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                      <Send size={16} />
                      {editingComment ? '수정' : replyingTo ? '답글' : '작성'}
                    </button>
                  </form>
                </div>
              </div>

              {(viewingPost.user_id === user?.id || user?.is_admin) && (
                <div className="flex gap-2 mt-6 pt-4 border-t border-slate-200">
                  <button
                    onClick={() => { handleCloseView(); handleEdit(viewingPost); }}
                    className="flex items-center gap-2 px-4 py-2 border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    <Edit2 size={16} />
                    수정
                  </button>
                  <button
                    onClick={() => { handleCloseView(); handleDelete(viewingPost); }}
                    className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={16} />
                    삭제
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 댓글 알림 모달 */}
      {showNotifications && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[80vh] overflow-hidden shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">댓글 알림</h2>
              <div className="flex items-center gap-2">
                {unreadNotificationCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    모두 읽음
                  </button>
                )}
                {notifications.some(n => n.is_read) && (
                  <button
                    onClick={handleDeleteReadNotifications}
                    className="text-xs text-red-500 hover:underline"
                  >
                    읽은 알림 삭제
                  </button>
                )}
                <button
                  onClick={() => setShowNotifications(false)}
                  className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X size={20} className="text-slate-500" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto max-h-[60vh]">
              {notifications.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Bell size={48} className="mx-auto mb-3 opacity-30" />
                  <p>알림이 없습니다</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    style={{
                      padding: '16px 24px',
                      borderBottom: '1px solid #e2e8f0',
                      cursor: 'pointer',
                      backgroundColor: notification.is_read ? '#ffffff' : '#fef2f2',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = notification.is_read ? '#f8fafc' : '#fee2e2'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = notification.is_read ? '#ffffff' : '#fef2f2'}
                  >
                    <div className="flex items-start gap-3">
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: notification.is_read ? '#cbd5e1' : '#ef4444',
                        marginTop: '6px',
                        flexShrink: 0
                      }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-800">
                          <span className="font-semibold text-blue-600">{notification.commenter_name}</span>
                          님이 {notification.parent_comment_id ? '답글' : '댓글'}을 남겼습니다
                        </p>
                        <p className="text-xs text-slate-500 mt-1 truncate">
                          게시글: {notification.post_title}
                        </p>
                        {notification.parent_comment_content && (
                          <p className="text-xs text-slate-400 mt-1 line-clamp-1 italic">
                            내 댓글: "{notification.parent_comment_content}"
                          </p>
                        )}
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                          "{notification.comment_content}"
                        </p>
                        <p className="text-xs text-slate-400 mt-2">
                          {formatDate(notification.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
