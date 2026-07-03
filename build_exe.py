import os
import subprocess
import sys

def install_requirements():
    print("==================================================")
    print("Step 1: 필요한 라이브러리를 설치합니다...")
    print("==================================================")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("\n[성공] 필요한 라이브러리 설치가 완료되었습니다.\n")
    except subprocess.CalledProcessError as e:
        print(f"\n[오류] 라이브러리 설치 중 문제가 발생했습니다: {e}")
        sys.exit(1)

def build_exe():
    print("==================================================")
    print("Step 2: PyInstaller를 통해 EXE 파일을 빌드합니다...")
    print("==================================================")
    
    # 윈도우 Conda (Miniforge 등) 환경에서 DLL 누락(libexpat.dll, ffi-8.dll 등) 방지
    # Conda 환경의 DLL 디렉토리인 'Library/bin'을 시스템 PATH 최상단에 강제 추가하여 빌드합니다.
    python_dir = os.path.dirname(sys.executable)
    conda_library_bin = os.path.join(python_dir, 'Library', 'bin')
    
    env = os.environ.copy()
    if os.path.exists(conda_library_bin):
        env['PATH'] = conda_library_bin + os.path.pathsep + env.get('PATH', '')
        print(f"[정보] Conda DLL 참조 경로 추가: {conda_library_bin}")

    # PyInstaller 빌드 옵션 설정
    args = [
        'main.py',
        '--onefile',
        '--noconsole',
        '--clean',
        '--name=모두의_복붙',
        '--add-data=web;web'
    ]

    # 현재 파이썬 인터프리터(sys.executable) 하에서 pyinstaller 모듈을 서브프로세스로 안전하게 실행합니다.
    cmd = [sys.executable, "-m", "PyInstaller"] + args
    print(f"빌드 명령어: {' '.join(cmd)}")
    
    try:
        subprocess.check_call(cmd, env=env)
        print("\n==================================================")
        print("[성공] EXE 파일 빌드가 성공적으로 완료되었습니다!")
        print("결과물 확인 경로: [ dist ] 폴더 안의 '모두의_복붙.exe' 파일")
        print("==================================================")
    except subprocess.CalledProcessError as e:
        print(f"\n[오류] 빌드 중 에러가 발생했습니다: {e}")
        sys.exit(1)

if __name__ == "__main__":
    # requirements.txt 파일 존재 확인 및 자동 생성
    if not os.path.exists("requirements.txt"):
        with open("requirements.txt", "w", encoding="utf-8") as f:
            f.write("pyinstaller\npyautogui\npyperclip\nkeyboard\neel\n")
            
    install_requirements()
    build_exe()
