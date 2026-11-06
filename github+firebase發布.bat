@echo off
chcp 65001 >nul
title 全自動部署工具 (Firebase + GitHub)

echo ===================================================
echo   🌐 一鍵同步部署：Firebase Hosting + GitHub
echo ===================================================
echo.

set /p commit_msg="📝 請輸入更新說明 (直接按 Enter 預設為 'Deploy update'): "
if "%commit_msg%"=="" set commit_msg=Deploy update

echo.
echo 🔥 [1/2] 正在部署上線至 Firebase Hosting...
call firebase deploy

if %errorlevel% neq 0 (
    echo ❌ Firebase 部署失敗，已中斷流程。
    pause
    exit /b
)

echo.
echo 🚀 [2/2] 正在備份推送至 GitHub (huane82/flashcards)...
git add .
git commit -m "%commit_msg%"
git push origin main

echo.
echo ===================================================
echo   🎉 全部完成！Firebase 已更新上線，GitHub 已同步推送！
echo ===================================================
echo.
pause