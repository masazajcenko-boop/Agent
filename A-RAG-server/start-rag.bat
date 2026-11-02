@echo off
setlocal
chcp 65001 >nul
title A-RAG Local Memory
cd /d "%~dp0"
if not exist "data" mkdir "data"
if not exist ".venv\Scripts\python.exe" (
  echo [SETUP] Creating Python environment...
  py -3 -m venv .venv
  if errorlevel 1 goto no_python
)
echo [SETUP] Checking dependencies...
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 (
  echo [ERROR] Dependency installation failed.
  pause
  exit /b 1
)
echo [START] A-RAG at http://127.0.0.1:8765
".venv\Scripts\python.exe" -m uvicorn main:app --host 127.0.0.1 --port 8765
pause
exit /b 0
:no_python
echo [ERROR] Python 3 is not installed or launcher "py" is unavailable.
pause
exit /b 1
