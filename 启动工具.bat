@echo off
cd /d "%~dp0"
start "采集确认单本地审核工具" cmd /k "cd /d %~dp0 && npm start"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:5173/"
