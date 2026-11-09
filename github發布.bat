@echo off
:: 設定編碼為 UTF-8，避免中文亂碼
chcp 65001 >nul

echo ===================================
echo   GitHub 自動推送腳本 - lzhcard
echo ===================================
echo.

:: 1. 檢查 Git 狀態
echo [Step 1] 當前檔案變更狀態：
git status
echo.

:: 2. 提示輸入 Commit 訊息
set /p commit_msg="請輸入 Commit 訊息 (若直接按 Enter 則使用預設時間訊息): "

:: 若使用者未輸入，預設使用日期與時間作為 commit 訊息
if "%commit_msg%"=="" (
    set commit_msg=Update: %date% %time%
)

echo.
echo [Step 2] 正在新增變更檔案 (git add .)...
git add .

echo.
echo [Step 3] 正在提交變更 (git commit)...
git commit -m "%commit_msg%"

echo.
echo [Step 4] 正在推送到 GitHub (git push)...
:: 預設推送到 origin 的 main 分支（若你的預設分支是 master，請將 main 改為 master）
git push origin main

echo.
echo ===================================
echo   推送作業已完成！
echo ===================================
echo.
pause