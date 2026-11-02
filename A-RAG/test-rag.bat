@echo off
setlocal
cd /d "%~dp0"
if exist "config.bat" call "config.bat"
if not defined A_RAG_HOST set "A_RAG_HOST=127.0.0.1"
if not defined A_RAG_PORT set "A_RAG_PORT=8765"
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r=Invoke-RestMethod 'http://%A_RAG_HOST%:%A_RAG_PORT%/health' -TimeoutSec 4; $r | ConvertTo-Json; if ($r.status -ne 'ok') { exit 1 } } catch { Write-Host 'A-RAG is not responding. Start start-rag.bat first.' -ForegroundColor Yellow; exit 1 }"
if errorlevel 1 (pause & exit /b 1)
echo A-RAG health check passed.
pause
endlocal
