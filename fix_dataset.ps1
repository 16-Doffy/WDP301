# Fix 1: Update handleFileUpload to validate file types
$content = Get-Content 'D:\Desktop\WDP\WDP301\frontend\src\pages\Manager\Datasets.jsx' -Encoding UTF8 -Raw
$old = '  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadedFiles((prev) => [...prev, ...files]);
    setError(null);
  };'
$new = '  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // Validate file types match dataset type
    const datasetType = formData.type;
    const allowedExtensions = {
      image: /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i,
      text:  /\.(txt|csv|json|xml|md)$/i,
      audio: /\.(mp3|wav|ogg|m4a|aac|flac)$/i,
    };
    const zipExtension = /\.(zip|rar)$/i;

    const allowedRe = allowedExtensions[datasetType] || allowedExtensions.image;
    const invalidFiles = files.filter(f => !allowedRe.test(f.name) && !zipExtension.test(f.name));

    if (invalidFiles.length > 0) {
      setError(`Sai loai file! Dataset type "${datasetType}" chi chap nhan file ${datasetType} hoac zip/rar. File sai: ${invalidFiles.map(f => f.name).join(', ')}`);
      e.target.value = '''';
      return;
    }

    setUploadedFiles((prev) => [...prev, ...files]);
    setError(null);
  };'
$content = $content.Replace($old, $new)

# Fix 2: Update accept attribute
$old2 = 'accept="image/*,.zip,.rar"'
$new2 = 'accept="image/*,.zip,.rar,.txt,.csv,.json,.xml,.md,.mp3,.wav,.ogg,.m4a,.aac,.flac"'
$content = $content.Replace($old2, $new2)

$content | Set-Content 'D:\Desktop\WDP\WDP301\frontend\src\pages\Manager\Datasets.jsx' -Encoding UTF8
Write-Host "Done"
