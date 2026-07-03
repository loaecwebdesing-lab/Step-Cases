@echo off
chcp 65001 >nul
title STEP CASES - Publication simple
color 0A

echo.
echo  ╔══════════════════════════════════════════════════╗
echo  ║         STEP CASES - Publication Netlify         ║
echo  ╚══════════════════════════════════════════════════╝
echo.

if not exist "js\config.js" (
    echo  [!] js\config.js manquant - copie depuis config.example.js
    copy "js\config.example.js" "js\config.js" >nul
)

findstr /C:"YOUR_PROJECT" "js\config.js" >nul 2>&1
if %errorlevel%==0 (
    echo  ┌─────────────────────────────────────────────────┐
    echo  │  IMPORTANT : ouvre js\config.js et mets tes     │
    echo  │  cles Supabase AVANT de publier !               │
    echo  └─────────────────────────────────────────────────┘
    echo.
    echo  Ouverture de js\config.js ...
    start "" notepad "js\config.js"
    echo.
    pause
)

echo  Etape 1 : ouverture de Netlify Drop dans le navigateur...
start "" "https://app.netlify.com/drop"

echo.
echo  Etape 2 : ouverture du dossier du projet...
start "" explorer "%~dp0"

echo.
echo  ══════════════════════════════════════════════════
echo   GLISSE le dossier StepCases1 sur la page Netlify
echo   (ou le zip stepcases-site.zip si tu l'as cree)
echo  ══════════════════════════════════════════════════
echo.
echo  Astuce : selectionne TOUS les fichiers du dossier
echo  (index.html, css, js, assets...) et glisse-les.
echo.
pause
