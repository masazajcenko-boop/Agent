@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Python 3.10+ launcher not found. Install Python and enable PATH.
  pause
  exit /b 1
)
if not exist ".venv\Scripts\python.exe" (
  echo [1/3] Creating virtual environment...
  py -3 -m venv .venv
  if errorlevel 1 (echo [ERROR] Could not create virtual environment. & pause & exit /b 1)
)
echo [2/3] Installing dependencies...
".venv\Scripts\python.exe" -m pip install --upgrade pip
if errorlevel 1 (echo [ERROR] pip upgrade failed. & pause & exit /b 1)
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 (echo [ERROR] Dependency installation failed. & pause & exit /b 1)
echo [3/3] Verifying installation...
".venv\Scripts\python.exe" -c "import fastapi, uvicorn; print('FastAPI and Uvicorn: OK')"
if errorlevel 1 (echo [ERROR] Verification failed. & pause & exit /b 1)
if not exist "data" mkdir "data"
echo Installation complete. Start with start-rag.bat
pause
endlocal
