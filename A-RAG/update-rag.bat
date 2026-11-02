@echo off
setlocal
cd /d "%~dp0"
echo ==========================================
echo       A-RAG SAFE CODE UPDATER
echo ==========================================
echo.
echo This updates approved program files only.
echo Database, config.bat and .venv are protected.
echo.
where powershell >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Windows PowerShell was not found.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0update-rag.ps1"
if errorlevel 1 (
  echo.
  echo [ERROR] Update did not complete.
  pause
  exit /b 1
)
echo.
pause
endlocal
