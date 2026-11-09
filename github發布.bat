@echo off
chcp 65001 >nul
title 全自動部署工具 (GitHub)

echo ===================================================
echo   🌐 一鍵同步部署：GitHub
echo ===================================================
echo.

set /p commit_msg="📝 請輸入更新說明 (直接按 Enter 預設為 'Deploy update'): "
if "%commit_msg%"=="" set commit_msg=Deploy update

echo.
echo 🚀 [1/1] 正在備份推送至 GitHub (huane82/lzhcard)...
git add .
git commit -m "%commit_msg%"
git push origin main

echo.
echo ===================================================
echo   🎉 全部完成！ GitHub 已推送！
echo ===================================================
echo.
pause