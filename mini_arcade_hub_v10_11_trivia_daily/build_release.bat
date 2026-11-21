@echo off
setlocal
cd /d "%~dp0"
echo ========================================
echo Mini Arcade Hub - Windows release builder
echo ========================================
python --version
if errorlevel 1 (
  echo Python was not found. Install Python 3.11 or newer first.
  pause
  exit /b 1
)
echo Installing game dependencies and PyInstaller...
python -m pip install -r requirements.txt
if errorlevel 1 goto failed
python -m pip install pyinstaller
if errorlevel 1 goto failed
echo Building the distributable folder...
python -m PyInstaller --noconfirm --clean --windowed --onedir --name "Mini Arcade Hub" --icon "icon.ico" --add-data "icon.ico;." --add-data "icon.png;." --add-data "BeepBox-Song.mp3;." --add-data "confetti_celebration.gif;." --collect-all pygame --collect-all supabase --collect-all postgrest --collect-all realtime --collect-all storage3 --collect-all gotrue --collect-all supabase_auth --collect-all supabase_functions mini_arcade.py
if errorlevel 1 goto failed
copy /Y supabase_config.json "dist\Mini Arcade Hub\supabase_config.json" >nul
if errorlevel 1 goto failed
if not exist "dist\Mini Arcade Hub\local_saves" mkdir "dist\Mini Arcade Hub\local_saves"
echo.
echo Build complete!
echo Your shareable game folder is: dist\Mini Arcade Hub
echo Zip that entire folder and send it to your friends.
pause
exit /b 0
:failed
echo.
echo Build failed. Copy the error above and ask for help.
pause
exit /b 1
