$content = Get-Content 'd:/Desktop/WDP/WDP301/frontend/src/pages/Reviewer/Task.jsx' -Encoding UTF8
Write-Host "Total lines: $($content.Count)"
Write-Host "First 3 lines:"
$content[0..2] | ForEach-Object { Write-Host $_ }
Write-Host "Last 3 lines:"
$content[($content.Count-3)..($content.Count-1)] | ForEach-Object { Write-Host $_ }
