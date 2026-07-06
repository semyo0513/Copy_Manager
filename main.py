import eel
import pyautogui
import pyperclip
import time
import threading
import keyboard
import sys
import os
import csv
import io

# 매크로 실행 제어 플래그
is_running = False
macro_thread = None

# Eel 웹 에셋 디렉토리 경로 설정
# PyInstaller 빌드 시 리소스 경로가 임시폴더(_MEIPASS)로 복사되므로, 
# 해당 경로를 찾아 올바르게 서빙할 수 있도록 처리합니다.
if getattr(sys, 'frozen', False):
    # PyInstaller 빌드 실행 환경
    base_path = sys._MEIPASS
    web_dir = os.path.join(base_path, 'web')
else:
    # 로컬 개발 환경
    web_dir = 'web'

@eel.expose
def get_clipboard_data():
    """
    클립보드에 복사된 텍스트 데이터를 분석하여 엑셀 2차원 표 구조로 파싱합니다.
    csv.reader를 활용하여 셀 내부의 개행(Alt+Enter)도 정상적으로 문자 취급하여 행 꼬임을 차단합니다.
    """
    global is_running
    if is_running:
        return {"count": 0, "rows": []}
        
    try:
        raw_data = pyperclip.paste()
        if not raw_data:
            return {"count": 0, "rows": []}
            
        # raw_data 문자열을 파일 객체처럼 읽어들여 탭(\t) 구분자로 안전 파싱
        # csv.QUOTE_NONE 설정을 통해 문장 내 큰따옴표(")가 탭 구분 파싱을 뭉개는 것을 완벽 차단합니다.
        f = io.StringIO(raw_data.strip('\r\n'))
        reader = csv.reader(f, delimiter='\t', quoting=csv.QUOTE_NONE)
        
        parsed_rows = []
        total_cells_count = 0
        
        for row in reader:
            if not row or all(not cell.strip() for cell in row):
                continue
                
            cleaned_row = [cell.strip() for cell in row]
            parsed_rows.append(cleaned_row)
            total_cells_count += len(cleaned_row)
            
        return {
            "count": total_cells_count,
            "rows": parsed_rows
        }
    except Exception as e:
        print(f"클립보드 데이터 읽기 실패: {e}")
        return {"count": 0, "rows": []}

@eel.expose
def stop_macro():
    """
    실행 중인 매크로를 강제 정지합니다.
    """
    global is_running
    if is_running:
        is_running = False
        print("매크로 중지 요청됨")

@eel.expose
def start_macro(tab_count, delay, data_rows, active_columns):
    """
    새로운 스레드에서 가공된 데이터 배열을 바탕으로 자동 입력 매크로를 실행합니다.
    """
    global is_running, macro_thread
    if is_running:
        return
        
    is_running = True
    macro_thread = threading.Thread(
        target=run_automation_loop, 
        args=(tab_count, delay, data_rows, active_columns), 
        daemon=True
    )
    macro_thread.start()

def interruptible_sleep(duration):
    """
    0.05초 단위로 수시로 중지 여부를 감시하며 대기하는 지연 함수입니다.
    """
    global is_running
    steps = int(duration / 0.05)
    for _ in range(max(1, steps)):
        if not is_running or keyboard.is_pressed('esc') or keyboard.is_pressed('f12'):
            is_running = False
            return False
        time.sleep(0.05)
    return True

def run_automation_loop(tab_count, delay, data_rows, active_columns):
    """
    실제 자동 입력 루프가 동작하는 코어 로직입니다.
    """
    global is_running
    eel.set_running_state(True)()
    
    try:
        if not data_rows or not active_columns:
            eel.show_toast("입력할 데이터가 없거나 활성화된 열이 없습니다.", "error")()
            is_running = False
            eel.set_running_state(False)()
            return
            
        # 1. 활성화된 열의 데이터만 추출하여 1차원 입력 큐 구성
        items = []
        for row in data_rows:
            for col_idx in active_columns:
                if col_idx < len(row):
                    items.append(row[col_idx])
                    
        total_count = len(items)
        if total_count == 0:
            eel.show_toast("입력할 데이터 항목이 없습니다.", "warning")()
            is_running = False
            eel.set_running_state(False)()
            return
        
        # 2. 카운트다운 시작 대기 (3초)
        for i in range(3, 0, -1):
            if not is_running or keyboard.is_pressed('esc') or keyboard.is_pressed('f12'):
                is_running = False
                break
            eel.update_status(0, total_count, f"{i}초 뒤에 입력이 시작됩니다. 첫 번째 입력 창을 클릭해 두세요!")()
            time.sleep(1)
            
        # 3. 셀 단위 순차 입력
        for idx, item in enumerate(items):
            if not is_running or keyboard.is_pressed('esc') or keyboard.is_pressed('f12'):
                is_running = False
                break
                
            # 미리보기 텍스트 축약 표시
            display_val = item[:15] + "..." if len(item) > 15 else item
            eel.update_status(idx + 1, total_count, f"'{display_val}' 입력 중...")()
            
            # 클립보드로 문자 복사
            pyperclip.copy(item)
            time.sleep(0.05)
            
            # 붙여넣기 실행
            pyautogui.hotkey('ctrl', 'v')
            
            # 입력값 딜레이 대기
            if not interruptible_sleep(0.1):
                break
                
            # 지정된 횟수만큼 Tab 이동
            for t_idx in range(tab_count):
                if not is_running or keyboard.is_pressed('esc') or keyboard.is_pressed('f12'):
                    is_running = False
                    break
                pyautogui.press('tab')
                
                # 탭 키 입력 간의 최소 딜레이
                if not interruptible_sleep(0.05):
                    break
                    
            # 탭 입력 후 다음 셀 이동 전 지연 시간 대기
            if not interruptible_sleep(delay):
                break
                
        # 4. 결과 처리 피드백
        if is_running:
            eel.update_status(total_count, total_count, "입력 완료!")()
            eel.show_toast("모든 데이터 입력을 성공적으로 완료했습니다!", "success")()
        else:
            eel.update_status(0, total_count, "사용자에 의해 정지됨")()
            eel.show_toast("자동 입력이 중단되었습니다.", "warning")()
            
    except Exception as e:
        print(f"매크로 실행 오류: {e}")
        eel.show_toast(f"실행 중 오류 발생: {str(e)}", "error")()
    finally:
        is_running = False
        eel.set_running_state(False)()

# ==================== 글로벌 단축키 바인딩 ====================
# 어떤 포커스 상태이든 ESC 또는 F12가 입력되면 백그라운드에서 감지하여 즉시 매크로 루프를 중단합니다.
keyboard.add_hotkey('esc', stop_macro)
keyboard.add_hotkey('f12', stop_macro)

# ==================== Eel 구동 및 빌드 준비 ====================
if __name__ == '__main__':
    # Eel 초기화 (에셋 디렉토리 지정)
    eel.init(web_dir)
    
    # Eel UI 시작 (창 모드 크기 및 크롬 앱 모드로 실행)
    # --noconsole 빌드와 조화를 이루도록 브라우저 창을 600x720 크기로 조절합니다.
    try:
        eel.start('index.html', size=(600, 720), port=0)
    except (SystemExit, MemoryError, KeyboardInterrupt):
        # 사용자 프로그램 종료 시 정상 처리
        pass