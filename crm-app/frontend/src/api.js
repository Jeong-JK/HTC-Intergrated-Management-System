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

// Export axios instance for direct use
export { api }
export const get = (...args) => api.get(...args)
export const post = (...args) => api.post(...args)
export const put = (...args) => api.put(...args)
export const del = (...args) => api.delete(...args)

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

// htc_sales DB에서 업체 정보 조회
export const getSalesCompanies = (params) => api.get('/companies/sales/list', { params })

// CRM Companies (Sales DB)
export const getCrmCompanies      = (params) => api.get('/crm/companies', { params })
export const getCrmCompany        = (id)     => api.get(`/crm/companies/${id}`)
export const createCrmCompany     = (data)   => api.post('/crm/companies', data)
export const updateCrmCompany     = (id, d)  => api.put(`/crm/companies/${id}`, d)
export const deleteCrmCompany     = (id)     => api.delete(`/crm/companies/${id}`)
export const getCompanyContacts   = (id)     => api.get(`/crm/companies/${id}/contacts`)

// Teams
export const getTeams          = (params) => api.get('/teams', { params })
export const getTeam           = (id)     => api.get(`/teams/${id}`)
export const createTeam        = (data)   => api.post('/teams', data)
export const updateTeam        = (id, d)  => api.put(`/teams/${id}`, d)
export const deleteTeam        = (id)     => api.delete(`/teams/${id}`)

// Contacts
export const getContacts          = (params) => api.get('/contacts', { params })
export const getContact           = (id)     => api.get(`/contacts/${id}`)
export const getContactCategories = ()       => api.get('/contacts/categories')
export const createContact        = (data)   => api.post('/contacts', data)
export const updateContact        = (id, d)  => api.put(`/contacts/${id}`, d)
export const deleteContact        = (id)     => api.delete(`/contacts/${id}`)
export const resignContact        = (id)     => api.post(`/contacts/${id}/resign`)
export const restoreContact       = (id)     => api.post(`/contacts/${id}/restore`)
export const getStaleContacts     = (days)   => api.get('/contacts/stale', { params: { days } })
export const addTransferHistory   = (id, d)  => api.post(`/contacts/${id}/transfer-history`, d)
export const deleteTransferHistory = (contactId, historyId) => api.delete(`/contacts/${contactId}/transfer-history/${historyId}`)
export const exportContactsExcel  = ()       => api.get('/contacts/export/excel', { responseType: 'blob' })

// Meetings
export const getMeetings           = (params) => api.get('/meetings', { params })
export const getMeeting            = (id)     => api.get(`/meetings/${id}`)
export const createMeeting         = (data)   => api.post('/meetings', data)
export const updateMeeting         = (id, d)  => api.put(`/meetings/${id}`, d)
export const deleteMeeting         = (id)     => api.delete(`/meetings/${id}`)
export const getRecentMeetings     = (days)   => api.get('/meetings/recent', { params: { days } })
export const getCompanyTimeline    = (id)     => api.get(`/meetings/timeline/${id}`)

// Dashboard
export const getStaleCompaniesDashboard = () => api.get('/dashboard/stale-companies')
export const getDashboardSummary        = () => api.get('/dashboard/summary')
export const getAllContactsWithDates    = (params) => api.get('/dashboard/all-contacts-with-dates', { params })
export const bulkRenewContactDates      = (data) => api.post('/dashboard/bulk-renew-contacts', data)

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

// Google Drive Files
export const createContactFile  = (data)       => api.post('/drive-files/contact', data)
export const getContactFiles    = (contactId)  => api.get(`/drive-files/contact/${contactId}`)
export const deleteContactFile  = (fileId)     => api.delete(`/drive-files/contact/${fileId}`)
export const getFolderUrl       = (params)     => api.get('/drive-files/folder-url', { params })

// ─────────────────────────────────────────────────────────
// 견적서 (Quotations)
// ─────────────────────────────────────────────────────────
export const getQuotations        = (params) => api.get('/quotations', { params })
export const getQuotation         = (id)     => api.get(`/quotations/${id}`)
export const createQuotation      = (data)   => api.post('/quotations', data)
export const updateQuotation      = (id, d)  => api.put(`/quotations/${id}`, d)
export const deleteQuotation      = (id)     => api.delete(`/quotations/${id}`)
export const updateQuotationStatus = (id, d) => api.put(`/quotations/${id}/status`, d)
export const quotationToPO        = (id)     => api.post(`/quotations/${id}/to-po`)

// ─────────────────────────────────────────────────────────
// 발주서 (Purchase Orders)
// ─────────────────────────────────────────────────────────
export const getPurchaseOrders      = (params) => api.get('/purchase-orders', { params })
export const getPurchaseOrder       = (id)     => api.get(`/purchase-orders/${id}`)
export const createPurchaseOrder    = (data)   => api.post('/purchase-orders', data)
export const updatePurchaseOrder    = (id, d)  => api.put(`/purchase-orders/${id}`, d)
export const deletePurchaseOrder    = (id)     => api.delete(`/purchase-orders/${id}`)
export const updatePOStatus         = (id, d)  => api.put(`/purchase-orders/${id}/status`, d)

// ─────────────────────────────────────────────────────────
// 재고 품목 (Inventory Items - for quotation autocomplete)
// ─────────────────────────────────────────────────────────
export const getInventoryItems     = (params) => api.get('/inventory/items', { params })
export const getInventoryItemNames = (params) => api.get('/inventory/item-names', { params })
export const getInventoryItemsByName = (name) => api.get('/inventory/items/by-name', { params: { item_name: name } })
export const getInventoryConstants = ()       => api.get('/inventory/constants')
