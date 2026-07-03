@echo off
chcp 65001 >nul
title STEP CASES - Push GitHub
color 0B
cd /d "%~dp0"

echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║      STEP CASES - Push vers GitHub (deploy)      ║
echo  ╚══════════════════════════════════════════════════╝
echo.

git status
echo.

git push origin main
if %errorlevel% neq 0 (
    echo.
    echo  [ERREUR] Le push a echoue !
    echo  - Verifie ta connexion GitHub
    echo  - Ou utilise GitHub Desktop pour publier
    echo.
    pause
    exit /b 1
)

echo.
git status
echo.

findstr /C:"ahead of" git status 2>nul
if %errorlevel%==0 (
    echo  [ATTENTION] Des commits sont encore en local.
) else (
    echo  [OK] Push reussi - GitHub est a jour.
    echo.
    echo  Si Netlify est lie au repo Step-Cases :
    echo  - Va sur app.netlify.com ^> ton site ^> Deploys
    echo  - Un nouveau deploy doit apparaitre dans 1-2 min
    echo.
    echo  Si RIEN ne se passe sur Netlify :
    echo  - Ton site est peut-etre en mode Drop (manuel)
    echo  - Il faut le relier a GitHub (voir COMMENT-PUBLIER.txt)
)

echo.
pause
