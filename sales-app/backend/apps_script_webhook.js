/**
 * Google Sheets Apps Script - Webhook for DB Sync
 *
 * 설치 방법:
 * 1. 구글 시트 열기 → Extensions → Apps Script
 * 2. 이 코드 복사해서 붙여넣기
 * 3. SERVER_URL을 실제 서버 주소로 변경
 * 4. 저장 후 onEdit 함수 실행해서 권한 승인
 * 5. Triggers 메뉴에서 onEdit를 "On edit" 트리거로 설정 (optional, 자동 트리거됨)
 */

// 서버 주소 (EC2 인스턴스 IP 또는 도메인)
const SERVER_URL = 'http://YOUR_SERVER_IP:8001/api/sheets/webhook/sheet-update';

// 무한 루프 방지: 이 스크립트로 인한 수정인지 체크
const SCRIPT_PROPERTY_KEY = 'WEBHOOK_UPDATING';

/**
 * 셀 수정 시 자동 실행되는 트리거
 */
function onEdit(e) {
  // 무한 루프 방지
  const scriptProperties = PropertiesService.getScriptProperties();
  if (scriptProperties.getProperty(SCRIPT_PROPERTY_KEY) === 'true') {
    return;
  }

  try {
    const sheet = e.source.getActiveSheet();
    const sheetName = sheet.getName();

    // 동기화 대상 시트만 처리
    if (!sheetName.includes('매입') && !sheetName.includes('프로젝트')) {
      return;
    }

    const range = e.range;
    const row = range.getRow();
    const col = range.getColumn();
    const newValue = e.value || '';
    const oldValue = e.oldValue || '';

    // 헤더 행은 무시 (보통 1-4행)
    if (row <= 4) {
      return;
    }

    // 서버로 전송할 데이터
    const payload = {
      sheet_name: sheetName,
      row: row,
      col: col,
      value: newValue,
      old_value: oldValue
    };

    // Webhook 호출
    const options = {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true  // 에러 시에도 응답 받기
    };

    Logger.log('Sending webhook: ' + JSON.stringify(payload));

    const response = UrlFetchApp.fetch(SERVER_URL, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    Logger.log('Response: ' + responseCode + ' - ' + responseBody);

    if (responseCode !== 200) {
      // 에러 발생 시 로그만 남기고 계속 진행 (사용자에게 알림 X)
      Logger.log('Webhook error: ' + responseBody);
    }

  } catch (error) {
    // 에러가 나도 사용자 작업을 방해하지 않음
    Logger.log('Webhook exception: ' + error.toString());
  }
}


/**
 * 수동 테스트용 함수
 * Apps Script 에디터에서 실행 가능
 */
function testWebhook() {
  const testData = {
    sheet_name: '2026Y 매입',
    row: 10,
    col: 7,  // Supplier 컬럼
    value: 'Test Supplier',
    old_value: 'Old Supplier'
  };

  const options = {
    method: 'POST',
    contentType: 'application/json',
    payload: JSON.stringify(testData),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(SERVER_URL, options);
  Logger.log('Test response: ' + response.getContentText());
}


/**
 * 인증 테스트용 함수
 */
function testAuth() {
  // UrlFetchApp 권한 승인을 위해 한 번 실행
  const response = UrlFetchApp.fetch('https://www.google.com');
  Logger.log('Auth test OK');
}
