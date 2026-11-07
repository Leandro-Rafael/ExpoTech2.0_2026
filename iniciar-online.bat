@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Lixo Zero 2050 - online (Netlify)

rem ============================================================================
rem  Liga o sistema para o site do Netlify (https://lixozero123.netlify.app):
rem    1. abre o ngrok (endereco publico fixo que aponta para este PC);
rem    2. inicia o back-end exigindo a assinatura do Netlify em cada requisicao.
rem  Deixe as duas janelas abertas durante a apresentacao. Para parar: Ctrl+C.
rem  Uso local sem Netlify: rode o iniciar.bat normal.
rem ============================================================================

set "ROOT=%~dp0"
set "NGROK_URL=https://alphonso-quaky-unstimulatingly.ngrok-free.dev"
set "SITE=https://lixozero123.netlify.app"

rem Segredo da assinatura: fica comentado no backend\.env para o uso local nao exigir assinatura.
set "APP_PROXY_SIGNING_SECRET="
for /f "tokens=2 delims==" %%A in ('findstr /b /c:"# APP_PROXY_SIGNING_SECRET=" "%ROOT%backend\.env"') do set "APP_PROXY_SIGNING_SECRET=%%A"
if not defined APP_PROXY_SIGNING_SECRET (
  echo [ERRO] Nao achei a linha "# APP_PROXY_SIGNING_SECRET=" no backend\.env.
  pause
  exit /b 1
)

where ngrok >nul 2>nul || (
  echo [ERRO] ngrok nao encontrado. Instale em https://ngrok.com/download e rode "ngrok config add-authtoken".
  pause
  exit /b 1
)

echo [..] Abrindo o ngrok em outra janela: %NGROK_URL%
start "ngrok - Lixo Zero 2050" ngrok http 8080 --url=%NGROK_URL%

rem Quando o back-end responder, abre o site do Netlify (o endereco local recusa acesso sem assinatura).
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "for($i=0;$i -lt 400;$i++){try{if((Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 http://localhost:8080/actuator/health).StatusCode -eq 200){Start-Process '%SITE%';break}}catch{};Start-Sleep -Seconds 2}"

set "LZ_NO_BROWSER=1"
call "%ROOT%iniciar.bat" %*
