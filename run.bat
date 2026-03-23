@echo off
chcp 65001 > nul
title 老園丁窯烤麵包 - 開發伺服器

echo =========================================
echo   老園丁窯烤麵包 - 本地開發環境啟動
echo =========================================
echo.

:: 檢查 Node.js 是否安裝
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [錯誤] 找不到 Node.js，請先安裝 Node.js 18+
    echo        https://nodejs.org/
    pause
    exit /b 1
)

:: 檢查 .env.local 是否存在
if not exist ".env.local" (
    echo [警告] 找不到 .env.local，請參考 .env.example 建立環境變數檔案
    echo.
    if exist ".env.example" (
        echo --- .env.example 內容 ---
        type .env.example
        echo -------------------------
    )
    echo.
    pause
)

:: 安裝依賴套件（若 node_modules 不存在）
if not exist "node_modules" (
    echo [提示] 首次執行，正在安裝套件...
    npm install
    if %errorlevel% neq 0 (
        echo [錯誤] npm install 失敗
        pause
        exit /b 1
    )
    echo.
)

echo [選擇] 啟動模式：
echo   1. Vercel
echo   2. Node
echo.
set /p MODE="請輸入 1 或 2（預設 1）："
if "%MODE%"=="" set MODE=1

if "%MODE%"=="2" (
    echo.
    echo [啟動] Node.js 模式：http://localhost:3000
    echo.
    node server.js
) else (
    echo.
    echo [啟動] Vercel Dev 模式：http://localhost:3000
    echo.
    npx vercel@latest dev
)

pause
