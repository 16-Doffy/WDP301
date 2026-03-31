# Fix Manager/Datasets.jsx
$dsPath = "D:\Desktop\WDP\WDP301\frontend\src\pages\Manager\Datasets.jsx"
$content = [IO.File]::ReadAllText($dsPath, [Text.Encoding]::UTF8)

# Fix 1: handleFileUpload
$oldFn = 'const handleFileUpload = (e) => {`n    const files = Array.from(e.target.files || []);`n    if (!files.length) return;`n    setUploadedFiles((prev) => [...prev, ...files]);`n    setError(null);`n  };'
$newFn = 'const handleFileUpload = (e) => {`n    const files = Array.from(e.target.files || []);`n    if (!files.length) return;`n`n    const datasetType = formData.type;`n    const allowedExtensions = {`n      image: /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i,`n      text:  /\.(txt|csv|json|xml|md)$/i,`n      audio: /\.(mp3|wav|ogg|m4a|aac|flac)$/i,`n    };`n    const zipRe = /\.(zip|rar)$/i;`n    const allowed = allowedExtensions[datasetType] || allowedExtensions.image;`n    const invalid = files.filter(f => !allowed.test(f.name) && !zipRe.test(f.name));`n`n    if (invalid.length > 0) {`n      setError(` + "`Sai loai file! Dataset `" + "${datasetType}" + "` chi chap nhan file `" + "${datasetType}" + "` hoac zip/rar. File sai: `" + '${invalid.map(f => f.name).join(", ")}`);' + "`n      e.target.value = '';`n      return;`n    }`n`n    setUploadedFiles((prev) => [...prev, ...files]);`n    setError(null);`n  };'

if ($content.Contains('const handleFileUpload = (e) => {')) {
    $newContent = $content -replace 'const handleFileUpload = \(e\) => \{[^\}]+\};', $newFn
    [IO.File]::WriteAllText($dsPath, $newContent, [Text.Encoding]::UTF8)
    Write-Host "handleFileUpload updated"
} else {
    Write-Host "handleFileUpload NOT FOUND"
}

# Fix 2: accept attribute
$dsContent2 = [IO.File]::ReadAllText($dsPath, [Text.Encoding]::UTF8)
if ($dsContent2.Contains('accept="image/*,.zip,.rar"')) {
    $dsContent2 = $dsContent2 -replace 'accept="image/\*,.zip,.rar"', 'accept="image/*,.zip,.rar,.txt,.csv,.json,.xml,.md,.mp3,.wav,.ogg,.m4a,.aac,.flac"'
    [IO.File]::WriteAllText($dsPath, $dsContent2, [Text.Encoding]::UTF8)
    Write-Host "accept updated"
} else {
    Write-Host "accept NOT FOUND"
}

Write-Host "Done"
