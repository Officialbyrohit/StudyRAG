@echo off
title StudyRAG AI Study Assistant
echo ========================================================
echo         Launching StudyRAG AI Study Assistant...
echo ========================================================
cd /d "%~dp0"

if not exist ".venv\Scripts\activate.bat" (
    echo Error: .venv virtual environment not found in %~dp0
    pause
    exit /b
)

echo [1/2] Activating virtual environment...
call .venv\Scripts\activate

echo [2/2] Opening browser to http://127.0.0.1:8000 ...
start http://127.0.0.1:8000
echo.
echo Server is running with auto-reload enabled!
echo Any code changes will reflect immediately without restarting.
echo To stop the server, press Ctrl + C or close this window.
echo.
.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
pause
