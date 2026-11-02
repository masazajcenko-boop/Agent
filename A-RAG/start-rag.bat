@echo off
setlocal
cd /d "%~dp0"
if exist "config.bat" call "config.bat"
if not defined A_RAG_HOST set "A_RAG_HOST=127.0.0.1"
if not defined A_RAG_PORT set "A_RAG_PORT=8765"
if not exist ".venv\Scripts\python.exe" (
  echo [ERROR] Environment missing. Run install-rag.bat first.
  pause
  exit /b 1
)
echo Starting A-RAG at http://%A_RAG_HOST%:%A_RAG_PORT%
".venv\Scripts\python.exe" -m uvicorn main:app --host "%A_RAG_HOST%" --port "%A_RAG_PORT%"
pause
endlocal
