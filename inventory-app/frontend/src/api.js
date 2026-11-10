import axios from 'axios'
import { goHub } from './site.js'

const api = axios.create({ baseURL: '/api' })

// 점검 모드(423): 안내 후 메인허브로 — 한 번만
let lockNotified = false
const onLocked = (err) => {
  if (err.response?.status === 423 && !lockNotified) {
    lockNotified = true
    alert(err.response.data?.detail || '현재 수정중입니다. 관리자에게 문의하세요.')
    goHub()
  }
  return Promise.reject(err)
}
api.interceptors.response.use(r => r, onLocked)
axios.interceptors.response.use(r => r, onLocked) // axios를 직접 쓰는 화면용

// Constants
export const getConstants = () => api.get('/items/constants')

// Items
export const getItems       = (params) => api.get('/items', { params })
export const getSummary     = ()        => api.get('/items/summary')
export const getDetail      = (params)  => api.get('/items/detail', { params })
export const getItem        = (id)      => api.get(`/items/${id}`)
export const createItem     = (data)    => api.post('/items', data)
export const updateItem     = (id, d)   => api.put(`/items/${id}`, d)
export const deleteItem     = (id)      => api.delete(`/items/${id}`)
export const createBulkItem = (data)    => api.post('/items/bulk', data)
export const inboundBulk    = (data)    => api.post('/items/inbound-bulk', data)
export const updateItemsLocation = (data) => api.put('/items/bulk/location', data)
export const updateItemsLicense = (data) => api.put('/items/bulk/license', data)
export const updateItemsDescription = (data) => api.put('/items/bulk/description', data)
export const getItemNames   = (excludeAccessory = false) => api.get('/items/item-names', { params: { exclude_accessory: excludeAccessory } })
export const getItemsByName = (name)    => api.get('/items/by-name', { params: { item_name: name } })

// Inbound
export const getInbound              = (params) => api.get('/inbound', { params })
export const getInboundSummary       = ()       => api.get('/inbound/summary')
export const createInbound           = (data)   => api.post('/inbound', data)
export const updateInbound           = (id, d)  => api.put(`/inbound/${id}`, d)
export const deleteInbound           = (id)     => api.delete(`/inbound/${id}`)
export const bulkUpdateExchangeRate  = (data)   => api.put('/inbound/bulk/exchange-rate', data)

// Rentals
export const getRentals        = (params) => api.get('/rentals', { params })
export const getOverdue        = ()       => api.get('/rentals/overdue')
export const getCalendar       = (y, m)   => api.get('/rentals/calendar', { params: { year: y, month: m } })
export const createRental      = (data)   => api.post('/rentals', data)
export const returnRental      = (id, d)  => api.put(`/rentals/${id}/return`, d)
export const extendRental      = (id, d)  => api.put(`/rentals/${id}/extend`, d)
export const deleteRental      = (id)     => api.delete(`/rentals/${id}`)
export const updateRentalItem  = (id, d)  => api.put(`/rentals/${id}`, d)
export const deleteRentalGroup = (params) => api.post('/rentals/group/delete', null, { params })
export const updateRentalGroup = (data) => api.put('/rentals/group/update', data)
export const toggleNeedsCheck  = (id)   => api.put(`/rentals/${id}/toggle-check`)

// Rentals - Bulk (헤더-아이템 분리 구조)
export const createBulkRental     = (data)   => api.post('/rentals/bulk', data)
export const getBulkRentals       = (params) => api.get('/rentals/bulk', { params })
export const getBulkRentalDetail  = (id)     => api.get(`/rentals/bulk/${id}`)
export const returnBulkRental     = (id, d)  => api.put(`/rentals/bulk/${id}/return`, d)
export const deleteBulkRental     = (id)     => api.delete(`/rentals/bulk/${id}`)

// Companies (htc_sales DB에서 업체 정보 조회)
export const getCompanies      = (params) => api.get('/companies', { params })
export const getSalesCompanies = (params) => api.get('/companies/sales/list', { params })

// Deliveries
export const getDeliveries       = (params) => api.get('/deliveries', { params })
export const createDelivery      = (data)   => api.post('/deliveries', data)
export const confirmDelivery     = (id, data) => api.put(`/deliveries/${id}/confirm`, data)
export const deleteDelivery      = (id)     => api.delete(`/deliveries/${id}`)
export const updateDeliveryGroup = (data)   => api.put('/deliveries/group/update', data)

// Rack
export const getRacks       = ()          => api.get('/rack')
export const updateItemRack = (id, data)  => api.put(`/rack/item/${id}`, data)

// Settings
export const getSettings    = ()           => api.get('/settings')
export const addSetting     = (type, value) => api.post(`/settings/${encodeURIComponent(type)}/${encodeURIComponent(value)}`)
export const deleteSetting  = (type, value) => api.delete(`/settings/${encodeURIComponent(type)}/${encodeURIComponent(value)}`)

// Stats
export const getStats = () => api.get('/stats/summary')

// Alerts (실시간 조회)
export const getAlerts       = (includeUndecided = false) => api.get('/alerts', { params: { include_undecided: includeUndecided } })
export const getAlertStatus  = () => api.get('/alerts/status')

// Auth
export const login         = (data)   => api.post('/auth/login', data)
export const logout        = ()       => api.post('/auth/logout')
export const getMe         = ()       => api.get('/auth/me')
export const getUsers      = ()       => api.get('/auth/users')
export const getMaintenance  = ()       => api.get('/maintenance')
export const saveMaintenance = (sys, d) => api.put(`/maintenance/${sys}`, d)
export const createUser    = (data)   => api.post('/auth/users', data)
export const updateUser    = (id, d)  => api.put(`/auth/users/${id}`, d)
export const deleteUser    = (id)     => api.delete(`/auth/users/${id}`)
export const updateProfile = (data)   => api.put('/auth/profile', data)

// Posts (게시판)
export const getPosts           = ()       => api.get('/posts')
export const getPost            = (id)     => api.get(`/posts/${id}`)
export const createPost         = (data)   => api.post('/posts', data)
export const updatePost         = (id, d)  => api.put(`/posts/${id}`, d)
export const deletePost         = (id)     => api.delete(`/posts/${id}`)
export const markPostAsRead     = (id)     => api.post(`/posts/${id}/read`)
export const getUnreadPostCount = ()       => api.get('/posts/unread/count')

// Comments (댓글)
export const getComments    = (postId)           => api.get(`/posts/${postId}/comments`)
export const createComment  = (postId, data)     => api.post(`/posts/${postId}/comments`, data)
export const updateComment  = (postId, id, data) => api.put(`/posts/${postId}/comments/${id}`, data)
export const deleteComment  = (postId, id)       => api.delete(`/posts/${postId}/comments/${id}`)

// Comment Notifications (댓글 알림)
export const getCommentNotifications         = ()   => api.get('/notifications/comments')
export const getUnreadCommentNotificationCount = () => api.get('/notifications/comments/unread/count')
export const markNotificationAsRead          = (id) => api.post(`/notifications/comments/${id}/read`)
export const markAllNotificationsAsRead      = ()   => api.post('/notifications/comments/read-all')
export const deleteReadNotifications         = ()   => api.delete('/notifications/comments/read')

// Work Logs (업무일지 캘린더)
export const getWorkLogs     = (params) => api.get('/work-logs', { params })
export const getWorkLogUsers = ()       => api.get('/work-logs/users')
export const getWorkLogMissing = (day)  => api.get('/work-logs/missing', { params: { day } })
export const searchWorkLogs  = (q)      => api.get('/work-logs/search', { params: { q } })
export const createWorkLog   = (data)   => api.post('/work-logs', data)
export const updateWorkLog   = (id, d)  => api.put(`/work-logs/${id}`, d)
export const deleteWorkLog   = (id)     => api.delete(`/work-logs/${id}`)
