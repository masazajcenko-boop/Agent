@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Aurora - запуск проекта

set "PROJECT=E:\Agent"
set "RAG=E:\A-rag"
set "RAG_URL=http://127.0.0.1:8765/health"
set "CHROME="

echo.
echo ==========================================
echo             AURORA - START
echo ==========================================
echo.

if not exist "%PROJECT%\manifest.json" (
    echo [ОШИБКА] Не найден проект: %PROJECT%
    echo Проверь, что репозиторий распакован в E:\Agent.
    pause
    exit /b 1
)
echo [OK] Проект найден: %PROJECT%

if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined CHROME if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined CHROME if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "CHROME=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"

if not defined CHROME (
    echo [ОШИБКА] Google Chrome не найден.
    pause
    exit /b 1
)
echo [OK] Chrome найден.

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-RestMethod -Uri '%RAG_URL%' -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }"
if not errorlevel 1 (
    echo [OK] A-RAG уже отвечает.
) else (
    if exist "%RAG%\start-rag.bat" (
        echo [СТАРТ] Запускаю A-RAG из %RAG%...
        start "Aurora A-RAG" /min cmd /c ""%RAG%\start-rag.bat""
        timeout /t 4 /nobreak >nul
        powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-RestMethod -Uri '%RAG_URL%' -TimeoutSec 3 | Out-Null; exit 0 } catch { exit 1 }"
        if errorlevel 1 (
            echo [ПРЕДУПРЕЖДЕНИЕ] A-RAG пока не отвечает.
            echo Продолжаю запуск без долговременной памяти.
        ) else (
            echo [OK] A-RAG запущен.
        )
    ) else (
        echo [ПРЕДУПРЕЖДЕНИЕ] Не найден %RAG%\start-rag.bat
        echo Продолжаю запуск без A-RAG.
    )
)

echo.
tasklist /FI "IMAGENAME eq chrome.exe" 2>NUL | find /I "chrome.exe" >NUL
if not errorlevel 1 (
    echo Chrome уже запущен. Для загрузки расширения с параметром
    echo --load-extension лучше полностью закрыть Chrome и повторить запуск.
    choice /C YN /N /M "Всё равно попробовать открыть Chrome? (Y/N): "
    if errorlevel 2 (
        echo Запуск Chrome пропущен.
        pause
        exit /b 0
    )
)

echo.
echo [СТАРТ] Открываю Chrome с расширением Aurora...
start "Aurora Chrome" "%CHROME%" --new-window --load-extension="%PROJECT%" "chrome://extensions/"

echo.
echo Запуск передан Chrome.
echo Проверь chrome://extensions: расширение должно быть включено.
echo Если Chrome уже работал, закрой все его окна и повтори запуск.
echo.
pause
endlocal
