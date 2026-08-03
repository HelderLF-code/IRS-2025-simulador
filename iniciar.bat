@echo off
REM Arranca o simulador de IRS e abre o browser automaticamente (Windows).
setlocal
cd /d "%~dp0"

where python >nul 2>&1
if %errorlevel%==0 (
    set PYCMD=python
) else (
    set PYCMD=py
)

echo A iniciar o simulador de IRS em http://localhost:8000 ...
start "Simulador IRS - servidor (nao fechar)" cmd /k "%PYCMD% -m http.server 8000"

timeout /t 2 /nobreak >nul
start "" "http://localhost:8000"

echo.
echo O browser deve abrir automaticamente.
echo Para parar a aplicacao, fecha a janela "Simulador IRS - servidor".
pause >nul
