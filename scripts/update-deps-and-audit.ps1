<#
Script: update-deps-and-audit.ps1
Descripción: Actualiza dependencias críticas (xlsx, eslint, supabase, tailwind, globals), instala, ejecuta auditoría, genera reportes JSON y crea una rama con commit listo para push/PR.

Uso:
  PowerShell -ExecutionPolicy Bypass -File .\scripts\update-deps-and-audit.ps1

Nota: Revisar cambios antes de `git push`. Este script no fuerza `push` ni crea PR si no está instalado `gh`.
#>

param(
    [string]$BranchPrefix = "deps/update",
    [string]$RepoPath = "$(Split-Path -Parent $MyInvocation.MyCommand.Definition)\..",
    [switch]$CreatePR
)

Set-StrictMode -Version Latest

function Write-Log($m){ Write-Host "[update-deps] $m" }

Push-Location $RepoPath
try {
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $branch = "${BranchPrefix}/$timestamp"

    Write-Log "Creando rama: $branch"
    git checkout -b $branch

    Write-Log "Actualizando paquetes recomendados..."
    npm install xlsx@^0.20.2 --save
    npm install -D eslint@latest @eslint/js@latest eslint-plugin-react-refresh@latest
    npm install @supabase/supabase-js@latest tailwindcss@latest @tailwindcss/vite@latest globals@latest

    Write-Log "Instalando dependencias (npm install)"
    npm install

    Write-Log "Generando reportes de auditoría..."
    npm audit --json > npm-audit-after.json || Write-Log "npm audit returned non-zero exit code"
    npm outdated --json > npm-outdated-after.json || Write-Log "npm outdated returned non-zero exit code or no outdated"

    Write-Log "Ejecutando linter..."
    npm run lint || Write-Log "Lint falló — revisa los cambios"

    Write-Log "Preparando commit con los archivos cambiados"
    git add package.json package-lock.json npm-audit-after.json npm-outdated-after.json 2>$null
    if (git diff --staged --quiet) {
        Write-Log "No hay cambios para commitear. Los paquetes pueden no haber cambiado versión en package.json."
    } else {
        git commit -m "chore(deps): update xlsx, eslint, supabase, tailwind, globals and run audit"
        Write-Log "Commit creado en rama $branch"
    }

    if ($CreatePR) {
        if (Get-Command gh -ErrorAction SilentlyContinue) {
            Write-Log "Creando PR con gh (abrirá editor o usará --fill según configuración)"
            gh pr create --fill
        } else {
            Write-Log "gh CLI no encontrado. Para crear PR manualmente:"
            Write-Log "  git push -u origin $branch"
            Write-Log "  Abrir PR en GitHub o usar 'gh pr create' si instalas gh"
        }
    } else {
        Write-Log "Listo. Para subir la rama y abrir un PR:"
        Write-Log "  git push -u origin $branch"
        Write-Log "  Luego crea el PR en tu proveedor (o instala 'gh' y ejecuta 'gh pr create')"
    }

} finally {
    Pop-Location
}

Write-Log "Script finalizado. Revisa los archivos 'npm-audit-after.json' y 'npm-outdated-after.json' en la raíz del repo."
