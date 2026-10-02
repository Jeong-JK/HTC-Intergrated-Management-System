import { useState, useEffect } from 'react'
import { X, Copy, Check } from 'lucide-react'
import { getAlerts } from '../api.js'
import dayjs from 'dayjs'
import axios from 'axios'

export default function AlertBell() {
  const [alerts, setAlerts] = useState([])
  const [alertStatus, setAlertStatus] = useState({ overdue: 0, today: 0, day_1: 0, day_3: 0, upcoming: 0 })
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [copiedKey, setCopiedKey] = useState(null)
  const [includeUndecided, setIncludeUndecided] = useState(false)

  useEffect(() => {
    loadAlertStatus()
    const interval = setInterval(loadAlertStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (open) loadAlerts()
  }, [open, includeUndecided])

  const loadAlertStatus = async () => {
    try {
      const res = await axios.get('/api/alerts/status')
      setAlertStatus(res.data)
    } catch (e) {
      console.error('Failed to load alert status:', e)
    }
  }

  const loadAlerts = async () => {
    setLoading(true)
    try {
      const res = await getAlerts(includeUndecided)
      setAlerts(res.data)
    } catch (e) {
      console.error('Failed to load alerts:', e)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return dayjs(dateStr).format('YYYY-MM-DD')
  }

  const getDaysText = (daysOverdue, isUndecided) => {
    if (isUndecided || daysOverdue === null) return '미정'
    if (daysOverdue === 0) return '오늘 반납'
    if (daysOverdue > 0) return `${daysOverdue}일 지연`
    return `${Math.abs(daysOverdue)}일 남음`
  }

  // 업체명 + 반납예정일 + 대여일로 그룹화 (미정인 경우 대여일별로 구분)
  const groupAlerts = (alerts) => {
    const groups = {}

    alerts.forEach(alert => {
      const expectedReturn = alert.expected_return || 'undecided'
      const rentDate = alert.rent_date || ''
      // 미정인 경우 대여일도 키에 포함
      const key = alert.expected_return
        ? `${alert.borrower}|${expectedReturn}`
        : `${alert.borrower}|${expectedReturn}|${rentDate}`
      if (!groups[key]) {
        groups[key] = {
          key,
          borrower: alert.borrower,
          expected_return: alert.expected_return,
          rent_date: alert.rent_date,
          days_overdue: alert.days_overdue,
          contact_name: alert.contact_name,
          contact_phone: alert.contact_phone,
          is_undecided: alert.is_undecided || !alert.expected_return,
          items: []
        }
      }
      groups[key].items.push(alert)
    })

    return Object.values(groups)
  }

  const groupedAlerts = groupAlerts(alerts)

  const isActive = alertStatus.overdue > 0 || alertStatus.today > 0 || alertStatus.day_1 > 0 || alertStatus.day_3 > 0 || alertStatus.upcoming > 0

  // 버튼 스타일 직접 지정
  const getButtonStyle = () => {
    if (alertStatus.overdue > 0) {
      return { backgroundColor: '#ef4444', color: '#ffffff' } // red-500
    }
    if (alertStatus.today > 0) {
      return { backgroundColor: '#eab308', color: '#ffffff' } // yellow-500
    }
    if (alertStatus.day_1 > 0) {
      return { backgroundColor: '#f97316', color: '#ffffff' } // orange-500
    }
    if (alertStatus.day_3 > 0) {
      return { backgroundColor: '#84cc16', color: '#ffffff' } // lime-500
    }
    if (alertStatus.upcoming > 0) {
      return { backgroundColor: '#22c55e', color: '#ffffff' } // green-500
    }
    return { backgroundColor: '#e2e8f0', color: '#94a3b8' } // slate-200, slate-400
  }

  const getButtonText = () => {
    if (alertStatus.overdue > 0) return `반납 지연 ${alertStatus.overdue}건`
    if (alertStatus.today > 0) return `오늘 반납 ${alertStatus.today}건`
    if (alertStatus.day_1 > 0) return `내일 반납 ${alertStatus.day_1}건`
    if (alertStatus.day_3 > 0) return `3일 후 반납 ${alertStatus.day_3}건`
    if (alertStatus.upcoming > 0) return `반납 임박 ${alertStatus.upcoming}건`
    return '장비 반납 알림'
  }

  const getItemBadgeStyle = (daysOverdue, isUndecided) => {
    if (isUndecided || daysOverdue === null) return { backgroundColor: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1' }
    if (daysOverdue > 0) return { backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }
    if (daysOverdue === 0) return { backgroundColor: '#fefce8', color: '#ca8a04', border: '1px solid #fef08a' }
    if (daysOverdue === -1) return { backgroundColor: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa' }
    if (daysOverdue === -3) return { backgroundColor: '#f7fee7', color: '#65a30d', border: '1px solid #d9f99d' }
    return { backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }
  }

  // 전체 복사 기능
  const copyAllToClipboard = () => {
    const groupTexts = groupedAlerts.map(group => {
      // 같은 품목 수량 합산
      const itemMap = {}
      group.items.forEach(item => {
        const qty = parseInt(item.quantity) || 1
        if (itemMap[item.item_name]) {
          itemMap[item.item_name] += qty
        } else {
          itemMap[item.item_name] = qty
        }
      })

      // D-며칠 계산
      const daysOverdue = group.days_overdue
      const isUndecided = group.is_undecided
      let dDayText = ''
      if (isUndecided || daysOverdue === null) {
        dDayText = '미정'
      } else if (daysOverdue > 0) {
        dDayText = `연체 ${daysOverdue}일`
      } else if (daysOverdue === 0) {
        dDayText = 'D-Day'
      } else {
        dDayText = `D${daysOverdue}` // -3 → D-3
      }

      // 품목 리스트
      const itemEntries = Object.entries(itemMap)
      const itemsText = itemEntries.map(([name, qty], idx) => {
        if (idx === 0) {
          // 첫 번째 품목
          return `└┬ ${name}(${qty})`
        } else {
          const isLast = idx === itemEntries.length - 1
          const prefix = isLast ? '   └ ' : '   ├ '
          return `${prefix}${name}(${qty})`
        }
      }).join('\n')

      const returnDateText = isUndecided ? '미정' : formatDate(group.expected_return)
      const rentDateLine = isUndecided && group.rent_date ? `├대여일: ${formatDate(group.rent_date)}\n` : ''
      return `${group.borrower} (${dDayText})\n${rentDateLine}├반납일: ${returnDateText}\n${itemsText}`
    }).join('\n\n')

    const text = `[장비 반납 알림]\n\n${groupTexts}`

    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey('all')
      setTimeout(() => setCopiedKey(null), 2000)
    })
  }

  return (
    <>
      <button
        onClick={() => isActive && setOpen(true)}
        disabled={!isActive}
        style={{
          ...getButtonStyle(),
          padding: '8px 16px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '600',
          cursor: isActive ? 'pointer' : 'not-allowed',
          border: 'none',
          transition: 'all 0.2s'
        }}
      >
        {getButtonText()}
      </button>

      {open && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {/* 배경 */}
          <div
            onClick={() => setOpen(false)}
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)'
            }}
          />

          {/* 모달 */}
          <div style={{
            position: 'relative',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            width: '100%',
            maxWidth: '500px',
            maxHeight: '80vh',
            margin: '16px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* 헤더 */}
            <div style={{
              padding: '16px 24px',
              borderBottom: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b', margin: 0 }}>
                장비 반납 알림
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: '#64748b',
                  userSelect: 'none'
                }}>
                  <input
                    type="checkbox"
                    checked={includeUndecided}
                    onChange={(e) => setIncludeUndecided(e.target.checked)}
                    style={{
                      width: '16px',
                      height: '16px',
                      cursor: 'pointer',
                      accentColor: '#64748b'
                    }}
                  />
                  미정 포함
                </label>
                <button
                  onClick={copyAllToClipboard}
                  disabled={alerts.length === 0}
                  style={{
                    background: copiedKey === 'all' ? '#16a34a' : '#3b82f6',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    cursor: alerts.length === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    opacity: alerts.length === 0 ? 0.5 : 1,
                    transition: 'all 0.2s'
                  }}
                >
                  {copiedKey === 'all' ? <Check size={14} /> : <Copy size={14} />}
                  {copiedKey === 'all' ? '복사완료' : '전체복사'}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '4px', color: '#94a3b8'
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* 상태 요약 */}
            <div style={{
              padding: '12px 24px',
              backgroundColor: '#f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '24px',
              fontSize: '14px'
            }}>
              {alertStatus.overdue > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ef4444' }}></span>
                  <span style={{ color: '#dc2626', fontWeight: '600' }}>지연 {alertStatus.overdue}건</span>
                </span>
              )}
              {alertStatus.today > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#eab308' }}></span>
                  <span style={{ color: '#ca8a04', fontWeight: '600' }}>오늘 {alertStatus.today}건</span>
                </span>
              )}
              {alertStatus.day_1 > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#f97316' }}></span>
                  <span style={{ color: '#ea580c', fontWeight: '600' }}>내일 {alertStatus.day_1}건</span>
                </span>
              )}
              {alertStatus.day_3 > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#84cc16' }}></span>
                  <span style={{ color: '#65a30d', fontWeight: '600' }}>3일 후 {alertStatus.day_3}건</span>
                </span>
              )}
              {alertStatus.upcoming > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#22c55e' }}></span>
                  <span style={{ color: '#16a34a', fontWeight: '600' }}>임박 {alertStatus.upcoming}건</span>
                </span>
              )}
            </div>

            {/* 목록 */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {loading && (
                <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
                  로딩 중...
                </div>
              )}

              {!loading && alerts.length === 0 && (
                <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
                  알림이 없습니다
                </div>
              )}

              {!loading && alerts.length > 0 && groupedAlerts.map((group, groupIdx) => (
                <div
                  key={group.key}
                  style={{
                    borderBottom: '1px solid #e2e8f0'
                  }}
                >
                  {/* 그룹 헤더: 업체명 + 반납예정일 */}
                  <div style={{
                    padding: '16px 24px 12px 24px',
                    backgroundColor: group.items.length > 1 ? '#f8fafc' : 'transparent'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '6px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '18px', fontWeight: '800', color: '#020617', letterSpacing: '-0.02em' }}>
                          {group.borrower}
                        </div>
                      </div>
                      <span style={{
                        ...getItemBadgeStyle(group.days_overdue, group.is_undecided),
                        fontSize: '12px',
                        fontWeight: '700',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        whiteSpace: 'nowrap'
                      }}>
                        {getDaysText(group.days_overdue, group.is_undecided)}
                      </span>
                    </div>
                    {group.contact_name && (
                      <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '4px' }}>
                        담당: {group.contact_name}
                      </div>
                    )}
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                      {group.is_undecided && group.rent_date && (
                        <>
                          대여일: <span style={{ fontWeight: '500' }}>{formatDate(group.rent_date)}</span>
                          <span style={{ margin: '0 6px' }}>·</span>
                        </>
                      )}
                      반납예정: <span style={group.is_undecided ? { color: '#64748b', fontWeight: '500' } : (group.days_overdue > 0 ? { color: '#ef4444', fontWeight: '600' } : { fontWeight: '500' })}>
                        {group.is_undecided ? '미정' : formatDate(group.expected_return)}
                      </span>
                      {group.items.length > 1 && (
                        <span style={{ marginLeft: '8px', color: '#64748b', fontWeight: '600' }}>
                          · 품목 {group.items.length}개
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 그룹 내 품목들 */}
                  {group.items.map((item, itemIdx) => (
                    <div
                      key={item.rental_id || itemIdx}
                      style={{
                        padding: '8px 24px 8px 40px',
                        backgroundColor: '#fafbfc',
                        borderTop: itemIdx === 0 ? '1px solid #f1f5f9' : 'none'
                      }}
                    >
                      <div style={{ fontSize: '14px', color: '#475569' }}>
                        <span style={{ color: '#94a3b8', marginRight: '6px' }}>└</span>
                        {item.item_name}
                        {item.quantity > 1 && <span style={{ color: '#94a3b8', marginLeft: '6px' }}>({item.quantity}개)</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* 푸터 */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
              <button
                onClick={() => setOpen(false)}
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: '#334155',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
