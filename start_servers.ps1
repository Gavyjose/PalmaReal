# PowerShell Script to start Palma Real servers silently
Set-Location -Path $PSScriptRoot

# 1. Start Notification Server in the background
Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm start" -WorkingDirectory ".\notifications-server" -WindowStyle Hidden

# 2. Start Frontend Server in the background
# Vite is configured to open the browser automatically in vite.config.js
Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev" -WindowStyle Hidden
