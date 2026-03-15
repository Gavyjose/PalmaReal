Set objFSO = CreateObject("Scripting.FileSystemObject")
strPath = objFSO.GetParentFolderName(WScript.ScriptFullName)
Set objShell = CreateObject("WScript.Shell")
objShell.CurrentDirectory = strPath
objShell.Run "powershell.exe -ExecutionPolicy Bypass -File ""start_servers.ps1""", 0, False
