$ErrorActionPreference = 'Stop'
$env:FRISTA_ALLOWED_ORIGIN = 'http://192.168.1.127:3886'
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..\..'))
& bun run '.\tools\frista-agent\index.ts'
