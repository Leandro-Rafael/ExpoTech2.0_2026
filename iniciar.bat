@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title Lixo Zero 2050

rem ============================================================================
rem  Lixo Zero 2050 - inicia o sistema completo com um comando (Windows).
rem
rem    iniciar.bat              1a vez: compila front-end + back-end e inicia.
rem                             Depois: inicia direto (usa o que ja foi compilado).
rem    iniciar.bat --rebuild    recompila tudo (use depois de mudar o codigo).
rem
rem  Requisitos: JDK 25 (JAVA_HOME ou "java" no PATH) e, para compilar o
rem  front-end, Node.js 20+ (npm). Abre http://localhost:8080 sozinho.
rem  Para parar: Ctrl+C nesta janela (o banco embutido e desligado com seguranca).
rem ============================================================================

set "ROOT=%~dp0"
set "FRONT=%ROOT%frontend"
set "BACK=%ROOT%backend"
set "JAR=%BACK%\target\lixozero-api-1.0.0.jar"
set "REBUILD=0"
if /i "%~1"=="--rebuild" set "REBUILD=1"

rem ---------------------------------------------------------------- Java 25
if defined JAVA_HOME if exist "%JAVA_HOME%\bin\java.exe" goto :java_ok
for /d %%D in ("%USERPROFILE%\.jdks\jdk-25*") do set "JAVA_HOME=%%~fD"
if defined JAVA_HOME if exist "%JAVA_HOME%\bin\java.exe" goto :java_ok
set "JAVA_HOME="
for /f "delims=" %%J in ('where java 2^>nul') do if not defined JAVA_EXE set "JAVA_EXE=%%J"
if not defined JAVA_EXE (
  echo [ERRO] Java 25 nao encontrado. Instale o JDK 25 e defina JAVA_HOME.
  goto :fail
)
for %%P in ("!JAVA_EXE!\..\..") do set "JAVA_HOME=%%~fP"
:java_ok
set "JAVA=%JAVA_HOME%\bin\java.exe"
"%JAVA%" -version 2>&1 | findstr /r /c:"version \"25" >nul
if errorlevel 1 (
  echo [ERRO] E preciso o JDK 25. Encontrado em "%JAVA_HOME%":
  "%JAVA%" -version
  goto :fail
)
echo [ok] Java: %JAVA_HOME%

rem ---------------------------------------------------------------- front-end
set "NEED_FRONT=%REBUILD%"
if not exist "%FRONT%\dist\index.html" set "NEED_FRONT=1"
if "%NEED_FRONT%"=="1" (
  where npm >nul 2>nul
  if errorlevel 1 (
    echo [ERRO] Node.js/npm nao encontrado - necessario para compilar o front-end. Instale o Node.js 20+.
    goto :fail
  )
  pushd "%FRONT%"
  if not exist "node_modules\" (
    echo [..] Instalando dependencias do front-end ^(npm ci^)...
    call npm ci --no-audit --no-fund
    if errorlevel 1 ( popd & echo [ERRO] npm ci falhou. & goto :fail )
  )
  echo [..] Compilando o front-end ^(npm run build^)...
  call npm run build
  if errorlevel 1 ( popd & echo [ERRO] O build do front-end falhou. & goto :fail )
  popd
  set "REBUILD=1"
)
echo [ok] Front-end: %FRONT%\dist

rem ---------------------------------------------------------------- back-end (jar com o SPA embutido)
if not exist "%JAR%" set "REBUILD=1"
if "%REBUILD%"=="1" (
  echo [..] Empacotando o back-end com o front-end embutido ^(perfil spa^)...
  if exist "%BACK%\target\classes\static" rmdir /s /q "%BACK%\target\classes\static"
  pushd "%BACK%"
  call mvnw.cmd -q -Pspa -DskipTests package
  if errorlevel 1 ( popd & echo [ERRO] O build do back-end falhou. & goto :fail )
  popd
)
echo [ok] Pacote: %JAR%

rem ---------------------------------------------------------------- inicia
netstat -ano | findstr /r /c:":8080 .*LISTENING" >nul
if not errorlevel 1 (
  echo [ERRO] A porta 8080 ja esta em uso. Feche o outro programa ^(ou outra janela do Lixo Zero^) e tente de novo.
  goto :fail
)

echo.
echo  Lixo Zero 2050 iniciando em http://localhost:8080
echo  ^(a primeira inicializacao cria o banco e os dados de demonstracao e pode levar alguns minutos^)
echo.
echo  Contas de demonstracao:
echo    Morador  morador@ecotechzero.com.br / Recicla@2050
echo    Admin    admin@ecotechzero.com.br   / EcoTech@2050
echo    Coletor  coletor@ecotechzero.com.br / Coleta@2050
echo.
echo  Para parar: Ctrl+C nesta janela.
echo.

rem Abre o navegador quando a API responder (em segundo plano).
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "for($i=0;$i -lt 400;$i++){try{if((Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 http://localhost:8080/actuator/health).StatusCode -eq 200){Start-Process 'http://localhost:8080';break}}catch{};Start-Sleep -Seconds 2}"

rem Roda a partir de backend\ para os dados ficarem em backend\data (banco, chaves).
pushd "%BACK%"
"%JAVA%" -Xmx768m -XX:TieredStopAtLevel=1 -Dfile.encoding=UTF-8 -jar "%JAR%"
popd
exit /b 0

:fail
echo.
pause
exit /b 1
