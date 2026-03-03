@echo off
TITLE Palma Real - Sistema Social VIVO
color 0A

echo ===================================================
echo   INICIANDO SISTEMA PALMA REAL - SOCIAL VIVO
echo ===================================================
echo.

:: Iniciar el Servidor de Notificaciones en una nueva ventana
echo [+] Iniciando Servidor de Notificaciones (WhatsApp/Email)...
start "Notifications Server" cmd /k "cd notifications-server && npm start"

:: Iniciar el Frontend de la Aplicacion
echo [+] Iniciando Interfaz de Usuario (Vite)...
npm run dev

pause
