@echo off
title Ankora Linux 2.0 - ISO Derleyici
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-on-windows.ps1"
pause
