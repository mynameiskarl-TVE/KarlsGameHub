@echo off
cd /d "%~dp0"
python mini_arcade.py
if errorlevel 1 pause
