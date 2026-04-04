$ErrorActionPreference = "Continue"
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Set-Location "D:\Desktop\WDP\WDP301\frontend"
$env:CI = "true"
$process = Start-Process -FilePath "npm.cmd" -ArgumentList "run","build" -Wait -PassThru -NoNewWindow -RedirectStandardOutput "D:\Desktop\WDP\WDP301\_build_out.txt" -RedirectStandardError "D:\Desktop\WDP\WDP301\_build_err.txt"
Write-Host "Exit code: $($process.ExitCode)"
$out = Get-Content "D:\Desktop\WDP\WDP301\_build_out.txt" -Raw -ErrorAction SilentlyContinue
$err = Get-Content "D:\Desktop\WDP\WDP301\_build_err.txt" -Raw -ErrorAction SilentlyContinue
if ($out) { Write-Host $out }
if ($err) { Write-Host "[ERR]$err" }
