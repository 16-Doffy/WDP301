$content = Get-Content "d:\Desktop\WDP\WDP301\frontend\src\pages\Manager\Datasets.jsx" -Raw -Encoding UTF8
if ($content -match '      <\/Dialog>\r?\nexport default Datasets;') {
    $new = $content -replace '      <\/Dialog>\r?\nexport default Datasets;', "      <\/Dialog>`n`n      {/ Toast notification */}`n      <Snackbar`n        open={toast.open}`n        autoHideDuration={4000}`n        onClose={() => setToast({ ...toast, open: false })}`n        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}`n      >`n        <Alert severity={toast.severity} sx={{ bgcolor: toast.severity === 'error' ? '#7f1d1d' : '#14532d', color: '#fff' }}>`n          {toast.message}`n        <\/Alert>`n      <\/Snackbar>`n    <\/Box>`n  );`n};`n`nexport default Datasets;"
    Set-Content -Path "d:\Desktop\WDP\WDP301\frontend\src\pages\Manager\Datasets.jsx" -Value $new -Encoding UTF8
    Write-Host "SUCCESS: fixed ending"
} else {
    Write-Host "Pattern not found. Current ending:"
    $lines = $content -split "`n"
    $lines[$lines.Length-10..$lines.Length-1] | ForEach-Object { Write-Host $_ }
}
