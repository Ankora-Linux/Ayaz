@echo off
chcp 65001 >nul
title Ankora Linux 2.0 - ISO Derleme İstasyonu (Windows)
cls

echo ======================================================================
echo       ANKORA LINUX 2.0 (AYAZ DE) - WINDOWS CANLI ISO DERLEYİCİ        
echo ======================================================================
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-on-windows.ps1"

echo.
pause
