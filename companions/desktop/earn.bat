@echo off
rem PreCog Earn - double-click launcher. No installs; uses your Python.
setlocal
cd /d "%~dp0"
if not exist precog-earn-gui.py (
  echo precog-earn-gui.py is missing. Keep this .bat inside companions\desktop.
  pause
  exit /b 1
)
python precog-earn-gui.py %*
if errorlevel 1 (
  echo.
  echo Python reported an error ^(Python 3.9+ is required^).
  pause
)
