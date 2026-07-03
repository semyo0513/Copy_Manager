// DOM 요소 캐싱
const tabCountEl = document.getElementById('tabCount');
const btnMinus = document.getElementById('btnMinus');
const btnPlus = document.getElementById('btnPlus');

const delaySlider = document.getElementById('delaySlider');
const delayValueEl = document.getElementById('delayValue');

const clipboardStatusEl = document.getElementById('clipboardStatus');
const clipboardDescEl = document.getElementById('clipboardDesc');

const activeStatusContainer = document.getElementById('activeStatusContainer');
const countdownNumEl = document.getElementById('countdownNum');
const countdownTotalEl = document.getElementById('countdownTotal');
const statusTextMsgEl = document.getElementById('statusTextMsg');

const btnStart = document.getElementById('btnStart');
const btnStop = document.getElementById('btnStop');
const progressBar = document.getElementById('progressBar');
const toastContainer = document.getElementById('toastContainer');

let currentTabCount = 1;
let currentDelay = 0.2;
let isMacroRunning = false;

// 1. 탭 스피너 제어 (바운스 효과 포함)
function updateTabCount(val) {
    currentTabCount = Math.max(0, currentTabCount + val); // 0 이상 유지
    tabCountEl.textContent = currentTabCount;
    
    // 바운스 효과 추가
    tabCountEl.classList.remove('spinner-bounce');
    void tabCountEl.offsetWidth; // Reflow 트리거
    tabCountEl.classList.add('spinner-bounce');
}

btnMinus.addEventListener('click', () => updateTabCount(-1));
btnPlus.addEventListener('click', () => updateTabCount(1));

// 2. 딜레이 슬라이더 제어
delaySlider.addEventListener('input', (e) => {
    currentDelay = parseFloat(e.target.value);
    delayValueEl.textContent = `${currentDelay.toFixed(1)}초`;
});

// 3. 토스트 메시지 함수 노출
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fa-circle-check';
    if (type === 'error') icon = 'fa-circle-xmark';
    if (type === 'warning') icon = 'fa-triangle-exclamation';
    
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    toastContainer.appendChild(toast);
    
    // 3초 후 자동 제거
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// 4. 클립보드 데이터 확인 요청
async function checkClipboardData() {
    if (isMacroRunning) return;
    
    try {
        // 파이썬 백엔드로부터 파싱 결과 가져오기
        const data = await eel.get_clipboard_data()();
        if (data && data.count > 0) {
            clipboardDescEl.innerHTML = `총 <strong style="color: #00f2fe; font-size: 14px;">${data.count}개</strong>의 셀 데이터를 감지했습니다.<br><span style="font-size: 11px; opacity: 0.7;">(미리보기: ${data.preview})</span>`;
            btnStart.disabled = false;
        } else {
            clipboardDescEl.textContent = "클립보드에 복사된 엑셀 데이터가 없거나 올바르지 않습니다.";
            btnStart.disabled = true;
        }
    } catch (e) {
        console.error("클립보드 조회 중 요류: ", e);
    }
}

// 앱 포커스가 들어올 때 실시간 클립보드 체크
window.addEventListener('focus', checkClipboardData);
// 초기 로드 시 1회 감시 시작
setTimeout(checkClipboardData, 500);
// 주기적인 감지 (1.5초 주기)
setInterval(checkClipboardData, 1500);

// 5. 실행 및 정지 제어
btnStart.addEventListener('click', () => {
    if (isMacroRunning) return;
    
    // 파이썬 매크로 시작 함수 호출
    eel.start_macro(currentTabCount, currentDelay);
});

btnStop.addEventListener('click', () => {
    eel.stop_macro();
});

// 백엔드 호출 노출 함수들
eel.expose(show_toast);
function show_toast(message, type) {
    showToast(message, type);
}

eel.expose(set_running_state);
function set_running_state(isRunning) {
    isMacroRunning = isRunning;
    
    if (isRunning) {
        // UI 모드 전환 (입력 감지 비활성화, 진행 창 표시)
        btnStart.disabled = true;
        btnStart.classList.remove('btn-pulse');
        btnStop.disabled = false;
        btnMinus.disabled = true;
        btnPlus.disabled = true;
        delaySlider.disabled = true;
        
        clipboardStatusEl.style.display = 'none';
        activeStatusContainer.style.display = 'flex';
        progressBar.style.width = '0%';
    } else {
        // 일반 대기 모드로 원복
        btnStart.disabled = false;
        btnStart.classList.add('btn-pulse');
        btnStop.disabled = true;
        btnMinus.disabled = false;
        btnPlus.disabled = false;
        delaySlider.disabled = false;
        
        clipboardStatusEl.style.display = 'flex';
        activeStatusContainer.style.display = 'none';
        
        // 지연 후 클립보드 최신화
        setTimeout(checkClipboardData, 500);
    }
}

eel.expose(update_status);
function update_status(current, total, statusText) {
    // 텍스트 메시지 업데이트
    statusTextMsgEl.textContent = statusText;
    
    // 카운트다운 표시
    countdownNumEl.textContent = current;
    countdownTotalEl.textContent = `/ ${total}`;
    
    // 프로그레스 바 갱신
    if (total > 0) {
        const percentage = (current / total) * 100;
        progressBar.style.width = `${percentage}%`;
    } else {
        progressBar.style.width = '0%';
    }
}
