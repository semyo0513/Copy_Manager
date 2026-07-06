// DOM 요소 캐싱
const tabCountEl = document.getElementById('tabCount');
const btnMinus = document.getElementById('btnMinus');
const btnPlus = document.getElementById('btnPlus');

const delaySlider = document.getElementById('delaySlider');
const delayValueEl = document.getElementById('delayValue');

const clipboardStatusEl = document.getElementById('clipboardStatus');
const clipboardDescEl = document.getElementById('clipboardDesc');
const previewTableContainer = document.getElementById('previewTableContainer');

const activeStatusContainer = document.getElementById('activeStatusContainer');
const countdownNumEl = document.getElementById('countdownNum');
const countdownTotalEl = document.getElementById('countdownTotal');
const statusTextMsgEl = document.getElementById('statusTextMsg');

const btnStart = document.getElementById('btnStart');
const btnStop = document.getElementById('btnStop');
const progressBar = document.getElementById('progressBar');
const toastContainer = document.getElementById('toastContainer');

// 모달 DOM 캐싱
const detailModal = document.getElementById('detailModal');
const modalTitle = document.getElementById('modalTitle');
const modalTextViewer = document.getElementById('modalTextViewer');
const neisMockupTextarea = document.getElementById('neisMockupTextarea');
const neisByteCount = document.getElementById('neisByteCount');
const btnCloseModal = document.getElementById('btnCloseModal');

// 전역 상태 변수
let currentTabCount = 1;
let currentDelay = 0.2;
let isMacroRunning = false;

let currentDataRows = []; // 가공 및 병합이 가능한 로컬 2차원 데이터 배열
let activeColumns = [];   // 활성화된 열 인덱스 목록
let isMergeModeActive = false; // 선택 열 일괄 병합 모드 여부

// 드래그 선택 관련 상태 변수
let isSelecting = false;
let startCell = null; // { r, c }
let endCell = null;   // { r, c }
let mergeFloatBtn = null; // 플로팅 병합 버튼 엘리먼트
let mouseDownPos = { x: 0, y: 0 }; // 마우스 드래그 오작동 방지용 좌표

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

// 3. 토스트 메시지 함수
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fa-circle-check';
    if (type === 'error') icon = 'fa-circle-xmark';
    if (type === 'warning') icon = 'fa-triangle-exclamation';
    
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// 나이스 바이트 수 계산 함수 (한글 3바이트, 영문/공백 1바이트 기준)
function getByteLength(str) {
    let byteLength = 0;
    for (let i = 0; i < str.length; i++) {
        const charCode = str.charCodeAt(i);
        if (charCode <= 0x7f) {
            byteLength += 1;
        } else if (charCode <= 0x7ff) {
            byteLength += 2;
        } else {
            byteLength += 3; // 한글 3바이트 처리 (NEIS 시스템 표준)
        }
    }
    return byteLength;
}

// 4. 모달 제어 함수
function openModal(rowIdx, colIdx, cellValue) {
    modalTitle.textContent = `[${rowIdx + 1}행, ${colIdx + 1}열] 데이터 전체 보기`;
    modalTextViewer.textContent = cellValue || "(빈 칸)";
    neisMockupTextarea.textContent = cellValue || "";
    
    // 바이트 카운팅 갱신
    const bytes = getByteLength(cellValue || "");
    neisByteCount.textContent = bytes;
    
    detailModal.classList.add('active');
}

function closeModal() {
    detailModal.classList.remove('active');
}

btnCloseModal.addEventListener('click', closeModal);
detailModal.addEventListener('click', (e) => {
    if (e.target === detailModal) closeModal();
});

// ESC 키를 누르면 모달 닫기
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && detailModal.classList.contains('active')) {
        closeModal();
    }
});

// 5. 플로팅 병합 버튼 생성 및 초기화
function initMergeFloatBtn() {
    if (mergeFloatBtn) return;
    
    mergeFloatBtn = document.createElement('button');
    mergeFloatBtn.type = 'button';
    mergeFloatBtn.className = 'btn-merge-float';
    mergeFloatBtn.innerHTML = '<i class="fa-solid fa-code-merge"></i> 선택 셀 가로 병합';
    
    document.querySelector('.app-container').appendChild(mergeFloatBtn);
    mergeFloatBtn.addEventListener('click', executeMerge);
}

// 6. 가로 셀 병합 실행
function executeMerge() {
    if (!startCell || !endCell) return;
    
    const r = startCell.r;
    const minCol = Math.min(startCell.c, endCell.c);
    const maxCol = Math.max(startCell.c, endCell.c);
    
    // 선택 영역 데이터 추출 및 병합 (구분자: 한 칸 공백)
    const rowData = currentDataRows[r];
    const cellsToMerge = [];
    for (let c = minCol; c <= maxCol; c++) {
        if (rowData[c]) cellsToMerge.push(rowData[c]);
    }
    
    const mergedText = cellsToMerge.join(' ');
    
    // 첫 번째 셀에 병합 텍스트 반영 및 나머지 셀 비우기
    currentDataRows[r][minCol] = mergedText;
    for (let c = minCol + 1; c <= maxCol; c++) {
        currentDataRows[r][c] = '';
    }
    
    showToast(`${r + 1}행의 셀들이 정상 병합되었습니다.`, 'success');
    
    // 상태 초기화 및 갱신
    hideMergeFloatBtn();
    renderTable();
}

function hideMergeFloatBtn() {
    if (mergeFloatBtn) {
        mergeFloatBtn.style.display = 'none';
    }
    document.querySelectorAll('.preview-table td').forEach(td => {
        td.classList.remove('cell-selecting', 'cell-selected');
    });
    startCell = null;
    endCell = null;
}

// 7. 테이블 렌더링 함수
function renderTable() {
    if (!currentDataRows || currentDataRows.length === 0) {
        previewTableContainer.style.display = 'none';
        previewTableContainer.innerHTML = '';
        btnStart.disabled = true;
        
        const cbHeader = document.getElementById('colCheckboxHeader');
        if (cbHeader) cbHeader.style.display = 'none';
        return;
    }
    
    // 열 개수 분석
    const colCount = currentDataRows[0].length;
    
    // 7.1. [복원] 열 체크박스 헤더 생성 및 동적 주입
    let cbHeader = document.getElementById('colCheckboxHeader');
    if (!cbHeader) {
        cbHeader = document.createElement('div');
        cbHeader.id = 'colCheckboxHeader';
        cbHeader.className = 'col-checkbox-header';
        previewTableContainer.parentNode.insertBefore(cbHeader, previewTableContainer);
    }
    
    // 기존 체크박스 내용 비우고 새로 채우기
    cbHeader.innerHTML = '<span style="font-weight: 700; color: var(--neon-blue); margin-right: 4px;">복사할 열 선택:</span>';
    cbHeader.style.display = 'flex';
    
    for (let i = 0; i < colCount; i++) {
        const isChecked = activeColumns.includes(i);
        const item = document.createElement('label');
        item.className = 'col-checkbox-item';
        item.innerHTML = `<input type="checkbox" data-col-idx="${i}" ${isChecked ? 'checked' : ''}> 열 ${i + 1}`;
        
        item.querySelector('input').addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.colIdx);
            if (e.target.checked) {
                if (!activeColumns.includes(idx)) activeColumns.push(idx);
            } else {
                activeColumns = activeColumns.filter(c => c !== idx);
            }
            renderTable();
        });
        cbHeader.appendChild(item);
    }
    
    // [복원] '선택 열 일괄 병합 입력' 스위치 토글 추가
    const mergeSwitch = document.createElement('label');
    mergeSwitch.className = 'col-checkbox-item';
    mergeSwitch.style.marginLeft = 'auto'; // 우측 끝 정렬
    mergeSwitch.innerHTML = `<input type="checkbox" id="mergeModeCheckbox" ${isMergeModeActive ? 'checked' : ''}> <span style="color: var(--neon-pink); font-weight: 700;"><i class="fa-solid fa-compress"></i> 선택 열 병합 입력</span>`;
    
    mergeSwitch.querySelector('input').addEventListener('change', (e) => {
        isMergeModeActive = e.target.checked;
        if (isMergeModeActive) {
            showToast("선택된 열들을 하나로 묶어(줄바꿈 연결) 입력하는 모드가 활성화되었습니다.", "warning");
        } else {
            showToast("열 병합 입력 모드가 비활성화되었습니다. 각 열별로 순차 입력됩니다.", "success");
        }
        renderTable();
    });
    cbHeader.appendChild(mergeSwitch);
    
    // 7.2. HTML Table 드로잉
    let tableHtml = '<table class="preview-table">';
    
    tableHtml += '<thead><tr>';
    for (let i = 0; i < colCount; i++) {
        const isColumnActive = activeColumns.includes(i);
        tableHtml += `<th class="${isColumnActive ? '' : 'col-disabled'}">열 ${i + 1}</th>`;
    }
    tableHtml += '</tr></thead><tbody>';
    
    currentDataRows.forEach((row, rIdx) => {
        tableHtml += '<tr>';
        for (let cIdx = 0; cIdx < colCount; cIdx++) {
            const isColumnActive = activeColumns.includes(cIdx);
            const val = row[cIdx] !== undefined ? row[cIdx] : '';
            
            // 특수문자 이스케이프
            const escaped = val
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
                
            const cellClass = isColumnActive ? '' : 'col-disabled';
            tableHtml += `<td class="${cellClass}" data-row="${rIdx}" data-col="${cIdx}" title="클릭 시 전체 보기"><div class="cell-content">${escaped || '<span style="color: rgba(255,255,255,0.15); font-style: italic;">[빈 칸]</span>'}</div></td>`;
        }
        tableHtml += '</tr>';
    });
    tableHtml += '</tbody></table>';
    
    previewTableContainer.innerHTML = tableHtml;
    previewTableContainer.style.display = 'block';
    
    // 7.3. 드래그 및 클릭 상호작용 이벤트 바인딩
    const cells = previewTableContainer.querySelectorAll('.preview-table td');
    cells.forEach(cell => {
        const r = parseInt(cell.dataset.row);
        const c = parseInt(cell.dataset.col);
        
        // 7.3.1. 드래그 시작 감지
        cell.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; // 좌클릭만
            if (!activeColumns.includes(c)) return; // 비활성화 열 제외
            
            isSelecting = true;
            startCell = { r, c };
            endCell = { r, c };
            mouseDownPos = { x: e.clientX, y: e.clientY }; // 다운 시 좌표 저장
            
            hideMergeFloatBtn();
            startCell = { r, c }; // hide 함수가 날려버리므로 다시 지정
            cell.classList.add('cell-selecting');
        });
        
        // 7.3.2. 드래그 이동 감지
        cell.addEventListener('mouseenter', () => {
            if (!isSelecting || !startCell) return;
            if (startCell.r !== r) return; // 동일 행 가로 병합만
            if (!activeColumns.includes(c)) return; // 비활성화 열 제외
            
            endCell = { r, c };
            
            const minCol = Math.min(startCell.c, endCell.c);
            const maxCol = Math.max(startCell.c, endCell.c);
            
            cells.forEach(td => {
                const tdR = parseInt(td.dataset.row);
                const tdC = parseInt(td.dataset.col);
                if (tdR === r && tdC >= minCol && tdC <= maxCol) {
                    td.classList.add('cell-selecting');
                } else {
                    td.classList.remove('cell-selecting');
                }
            });
        });
        
        // 7.3.3. 단일 클릭 팝업 연동 (드래그와 엉키지 않도록 오프셋 감지)
        cell.addEventListener('click', (e) => {
            const distance = Math.sqrt(Math.pow(e.clientX - mouseDownPos.x, 2) + Math.pow(e.clientY - mouseDownPos.y, 2));
            if (distance < 5) {
                const cellValue = currentDataRows[r][c];
                openModal(r, c, cellValue);
                hideMergeFloatBtn();
            }
        });
    });
    
    // 7.4. 감지 건수 및 버튼 활성화 갱신
    const activeCellCount = currentDataRows.reduce((acc, row) => {
        return acc + row.filter((_, idx) => activeColumns.includes(idx)).length;
    }, 0);
    
    if (activeCellCount > 0) {
        if (isMergeModeActive) {
            clipboardDescEl.innerHTML = `총 <strong style="color: #00f2fe; font-size: 14px;">${currentDataRows.length}행 (병합 입력 대상: ${currentDataRows.length}회)</strong>의 데이터를 감지했습니다.`;
        } else {
            clipboardDescEl.innerHTML = `총 <strong style="color: #00f2fe; font-size: 14px;">${currentDataRows.length}행 (일반 입력 대상: ${activeCellCount}개 셀)</strong>의 데이터를 감지했습니다.`;
        }
        btnStart.disabled = false;
    } else {
        clipboardDescEl.innerHTML = `총 <strong style="color: #ff0844; font-size: 14px;">${currentDataRows.length}행 (선택된 열 없음)</strong><br><span style="font-size: 11px; opacity: 0.7;">입력할 열 체크박스를 선택해 주세요.</span>`;
        btnStart.disabled = true;
    }
}

// 8. 마우스 업 전역 리스너: 드래그 다중 범위 확정 시 병합 단추 노출
window.addEventListener('mouseup', (e) => {
    if (!isSelecting) return;
    isSelecting = false;
    
    if (startCell && endCell) {
        const r = startCell.r;
        const minCol = Math.min(startCell.c, endCell.c);
        const maxCol = Math.max(startCell.c, endCell.c);
        
        if (minCol === maxCol) {
            return;
        }
        
        const cells = previewTableContainer.querySelectorAll('.preview-table td');
        let lastSelectedCell = null;
        
        cells.forEach(td => {
            const tdR = parseInt(td.dataset.row);
            const tdC = parseInt(td.dataset.col);
            if (tdR === r && tdC >= minCol && tdC <= maxCol) {
                td.classList.remove('cell-selecting');
                td.classList.add('cell-selected');
                if (tdC === maxCol) {
                    lastSelectedCell = td;
                }
            }
        });
        
        if (lastSelectedCell && mergeFloatBtn) {
            const rect = lastSelectedCell.getBoundingClientRect();
            const appRect = document.querySelector('.app-container').getBoundingClientRect();
            
            mergeFloatBtn.style.top = `${rect.top - appRect.top + window.scrollY}px`;
            mergeFloatBtn.style.left = `${rect.left - appRect.left + (rect.width / 2) + window.scrollX}px`;
            mergeFloatBtn.style.display = 'block';
        }
    }
});

// 외부 영역 클릭 시 병합 선택 취소
document.addEventListener('mousedown', (e) => {
    if (mergeFloatBtn && e.target !== mergeFloatBtn && !previewTableContainer.contains(e.target)) {
        hideMergeFloatBtn();
    }
});

// 9. 클립보드 데이터 확인 요청
async function checkClipboardData() {
    if (isMacroRunning) return;
    
    try {
        const data = await eel.get_clipboard_data()();
        if (data && data.count > 0 && data.rows && data.rows.length > 0) {
            const isSameData = JSON.stringify(data.rows) === JSON.stringify(currentDataRows);
            
            if (!isSameData) {
                currentDataRows = data.rows;
                
                // 열 활성화 상태 초기화
                const colCount = currentDataRows[0].length;
                activeColumns = [];
                for (let i = 0; i < colCount; i++) {
                    activeColumns.push(i);
                }
                
                renderTable();
            }
        } else {
            if (currentDataRows.length > 0) {
                currentDataRows = [];
                activeColumns = [];
                renderTable();
            }
            clipboardDescEl.textContent = "클립보드에 복사된 엑셀 데이터가 없거나 올바르지 않습니다.";
            btnStart.disabled = true;
        }
    } catch (e) {
        console.error("클립보드 조회 중 오류: ", e);
    }
}

// 10. 앱 로딩 시 초기화
window.addEventListener('focus', checkClipboardData);
setTimeout(() => {
    checkClipboardData();
    initMergeFloatBtn();
}, 500);

// 주기적인 감시 (1.5초 주기)
setInterval(checkClipboardData, 1500);

// 11. 실행 및 정지 제어
btnStart.addEventListener('click', () => {
    if (isMacroRunning) return;
    
    const activeColsToSend = [...activeColumns].sort((a, b) => a - b);
    
    if (isMergeModeActive) {
        // [일괄 병합 모드 작동]
        const processedRows = currentDataRows.map(row => {
            const cellsToMerge = [];
            activeColsToSend.forEach(idx => {
                if (row[idx] !== undefined && row[idx] !== '') {
                    cellsToMerge.push(row[idx]);
                }
            });
            return [cellsToMerge.join('\n')];
        });
        eel.start_macro(currentTabCount, currentDelay, processedRows, [0]);
    } else {
        // [일반 개별 입력 모드 작동]
        eel.start_macro(currentTabCount, currentDelay, currentDataRows, activeColsToSend);
    }
});

btnStop.addEventListener('click', () => {
    eel.stop_macro();
});

// 백엔드 통신 노출 API 함수들
eel.expose(show_toast);
function show_toast(message, type) {
    showToast(message, type);
}

eel.expose(set_running_state);
function set_running_state(isRunning) {
    isMacroRunning = isRunning;
    
    if (isRunning) {
        btnStart.disabled = true;
        btnStart.classList.remove('btn-pulse');
        btnStop.disabled = false;
        btnMinus.disabled = true;
        btnPlus.disabled = true;
        delaySlider.disabled = true;
        
        const cbHeader = document.getElementById('colCheckboxHeader');
        if (cbHeader) cbHeader.style.display = 'none';
        
        clipboardStatusEl.style.display = 'none';
        activeStatusContainer.style.display = 'flex';
        progressBar.style.width = '0%';
    } else {
        btnStart.disabled = false;
        btnStart.classList.add('btn-pulse');
        btnStop.disabled = true;
        btnMinus.disabled = false;
        btnPlus.disabled = false;
        delaySlider.disabled = false;
        
        clipboardStatusEl.style.display = 'flex';
        activeStatusContainer.style.display = 'none';
        
        setTimeout(checkClipboardData, 500);
    }
}

// 상태 갱신 통신 함수
eel.expose(update_status);
function update_status(current, total, statusText) {
    statusTextMsgEl.textContent = statusText;
    
    countdownNumEl.textContent = current;
    countdownTotalEl.textContent = `/ ${total}`;
    
    if (total > 0) {
        const percentage = (current / total) * 100;
        progressBar.style.width = `${percentage}%`;
    } else {
        progressBar.style.width = '0%';
    }
}
