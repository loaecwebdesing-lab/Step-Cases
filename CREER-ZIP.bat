@echo off
chcp 65001 >nul
echo Creation du zip pour Netlify...

if not exist "js\config.js" (
    echo ERREUR : js\config.js manquant ! Copie config.example.js et remplis tes cles Supabase.
    pause
    exit /b 1
)

powershell -Command "Compress-Archive -Path 'index.html','css','js','assets','netlify.toml','supabase' -DestinationPath 'stepcases-site.zip' -Force"
if exist stepcases-site.zip (
    echo OK : stepcases-site.zip cree !
    explorer /select,"%~dp0stepcases-site.zip"
) else (
    echo Erreur lors de la creation du zip.
)
pause
