// 접속 도메인별 화면: inv.hltac.com = 재고관리, cal.hltac.com = 업무일지, 그 외(ims, 로컬) = 메인허브
const { protocol, hostname } = window.location

export const SITE = hostname.startsWith('inv.') ? 'inventory'
  : hostname.startsWith('cal.') ? 'worklog'
  : 'hub'

// 재고관리 경로: inv 도메인에선 루트, 메인허브(로컬 개발 등)에선 /inventory 아래
const INV_BASE = SITE === 'inventory' ? '' : '/inventory'
export const invPath = (path = '') => INV_BASE + path || '/'

// 메인허브로 이동 (서브도메인에서는 ims로)
export const goHub = () => {
  window.location.href = hostname.endsWith('hltac.com') ? `${protocol}//ims.hltac.com/` : '/'
}
