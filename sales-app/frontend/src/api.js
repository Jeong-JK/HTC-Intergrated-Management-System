import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

// 점검 모드(423): 안내 후 메인허브로 — 한 번만
let lockNotified = false
const onLocked = (err) => {
  if (err.response?.status === 423 && !lockNotified) {
    lockNotified = true
    alert(err.response.data?.detail || '현재 점검중입니다. 관리자에게 문의하세요.')
    const { protocol, hostname } = window.location
    window.location.href = hostname.endsWith('hltac.com') ? `${protocol}//ims.hltac.com/` : `${protocol}//${hostname}:8000/`
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

// Inbound
export const getInbound              = (params) => api.get('/inbound', { params })
export const getInboundSummary       = ()       => api.get('/inbound/summary')
export const createInbound           = (data)   => api.post('/inbound', data)
export const updateInbound           = (id, d)  => api.put(`/inbound/${id}`, d)
export const deleteInbound           = (id)     => api.delete(`/inbound/${id}`)
export const bulkUpdateExchangeRate  = (data)   => api.put('/inbound/bulk/exchange-rate', data)

// Rentals
export const getRentals   = (params) => api.get('/rentals', { params })
export const getOverdue   = ()       => api.get('/rentals/overdue')
export const getCalendar  = (y, m)   => api.get('/rentals/calendar', { params: { year: y, month: m } })
export const createRental = (data)   => api.post('/rentals', data)
export const returnRental = (id, d)  => api.put(`/rentals/${id}/return`, d)
export const deleteRental = (id)     => api.delete(`/rentals/${id}`)

// Rentals - Bulk (헤더-아이템 분리 구조)
export const createBulkRental     = (data)   => api.post('/rentals/bulk', data)
export const getBulkRentals       = (params) => api.get('/rentals/bulk', { params })
export const getBulkRentalDetail  = (id)     => api.get(`/rentals/bulk/${id}`)
export const returnBulkRental     = (id, d)  => api.put(`/rentals/bulk/${id}/return`, d)
export const deleteBulkRental     = (id)     => api.delete(`/rentals/bulk/${id}`)

// Companies (CRM)
export const getCompanies  = (params) => api.get('/companies', { params })
export const getCompany    = (id)     => api.get(`/companies/${id}`)
export const createCompany = (data)   => api.post('/companies', data)
export const updateCompany = (id, d)  => api.put(`/companies/${id}`, d)
export const deleteCompany = (id)     => api.delete(`/companies/${id}`)

// Note: getSalesCompanies는 inventory-app 전용 - sales-app에서 필요 시 백엔드 구현 필요

// Deliveries
export const getDeliveries   = (params) => api.get('/deliveries', { params })
export const createDelivery  = (data)   => api.post('/deliveries', data)
export const confirmDelivery = (id)     => api.put(`/deliveries/${id}/confirm`)
export const deleteDelivery  = (id)     => api.delete(`/deliveries/${id}`)

// Rack
export const getRacks      = ()          => api.get('/rack')
export const updateItemRack = (id, data)  => api.put(`/rack/item/${id}`, data)

// Settings
export const getSettings    = ()           => api.get('/settings')
export const addSetting     = (type, value) => api.post(`/settings/${encodeURIComponent(type)}/${encodeURIComponent(value)}`)
export const deleteSetting  = (type, value) => api.delete(`/settings/${encodeURIComponent(type)}/${encodeURIComponent(value)}`)

// Stats
export const getStats = () => api.get('/stats/summary')

// ============ Sales Pipeline APIs ============

// Purchases (매입 관리)
export const getPurchases = (params) => api.get('/purchases', { params })
export const getPurchasesByPO = (params) => api.get('/purchases/by-po', { params })
export const getPurchasesByPONumber = (poNumber, year = new Date().getFullYear()) => api.get(`/purchases/by-po/${encodeURIComponent(poNumber)}`, { params: { year } })
export const getPurchase = (id) => api.get(`/purchases/${id}`)
export const createPurchase = (data) => api.post('/purchases', data)
export const updatePurchase = (id, data) => api.put(`/purchases/${id}`, data)
export const deletePurchase = (id) => api.delete(`/purchases/${id}`)
export const getPurchaseStats = (params) => api.get('/purchases/stats/summary', { params })

// Projects (프로젝트 관리)
export const getProjects = (params) => api.get('/projects', { params })
export const getProject = (id) => api.get(`/projects/${id}`)
export const createProject = (data) => api.post('/projects', data)
export const updateProject = (id, data) => api.put(`/projects/${id}`, data)
export const deleteProject = (id) => api.delete(`/projects/${id}`)
export const getProjectStats = (params) => api.get('/projects/stats/summary', { params })

// Weekly (Weekly 일정)
export const getWeeklySchedules = (params) => api.get('/weekly', { params })
export const getWeeklySchedule = (id) => api.get(`/weekly/${id}`)
export const createWeeklySchedule = (data) => api.post('/weekly', data)
export const updateWeeklySchedule = (id, data) => api.put(`/weekly/${id}`, data)
export const deleteWeeklySchedule = (id) => api.delete(`/weekly/${id}`)
export const getProjectItems = (projectNo) => api.get(`/weekly/project/${encodeURIComponent(projectNo)}`)

// Posts (Dashboard)
export const getPosts = () => api.get('/posts')
export const getPost = (id) => api.get(`/posts/${id}`)
export const createPost = (data) => api.post('/posts', data)
export const updatePost = (id, data) => api.put(`/posts/${id}`, data)
export const deletePost = (id) => api.delete(`/posts/${id}`)
