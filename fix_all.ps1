# Fix ImageViewer.jsx
Write-Host "Fixing ImageViewer.jsx..."
$ivPath = "D:\Desktop\WDP\WDP301\frontend\src\components\ImageViewer.jsx"
$ivContent = Get-Content $ivPath -Raw -Encoding UTF8

$oldReturn = @'
  return (
    <div
      ref={containerRef}
      className="relative inline-block max-w-full"
    >
      <img
        ref={imageRef}
        src={imageUrl}
        alt="Annotation target"
        className="block max-w-full"
        style={{
          maxHeight: maxHeight,
          width: 'auto',
          height: 'auto',
        }}
'@

$newReturn = @'
  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-center w-full h-full"
      style={{ minHeight: '200px' }}
    >
      <img
        ref={imageRef}
        src={imageUrl}
        alt="Annotation target"
        className="max-w-full max-h-full object-contain"
'@

$ivContent = $ivContent.Replace($oldReturn, $newReturn)

$oldMax = "maxHeight = '600px'"
$newMax = "maxHeight = '100%'"
$ivContent = $ivContent.Replace($oldMax, $newMax)

$ivContent | Set-Content $ivPath -Encoding UTF8 -NoNewline
Write-Host "Done ImageViewer.jsx"

# Fix Manager/Datasets.jsx - handleFileUpload validation
Write-Host "Fixing Manager/Datasets.jsx..."
$dsPath = "D:\Desktop\WDP\WDP301\frontend\src\pages\Manager\Datasets.jsx"
$dsContent = Get-Content $dsPath -Raw -Encoding UTF8

$oldUpload = @'
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadedFiles((prev) => [...prev, ...files]);
    setError(null);
  };
'@

$newUpload = @'
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const datasetType = formData.type;
    const allowedExtensions = {
      image: /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i,
      text:  /\.(txt|csv|json|xml|md)$/i,
      audio: /\.(mp3|wav|ogg|m4a|aac|flac)$/i,
    };
    const zipRe = /\.(zip|rar)$/i;
    const allowed = allowedExtensions[datasetType] || allowedExtensions.image;
    const invalid = files.filter(f => !allowed.test(f.name) && !zipRe.test(f.name));

    if (invalid.length > 0) {
      setError(`Sai loai file! Dataset "${datasetType}" chi chap nhan file ${datasetType} hoac zip/rar. File sai: ${invalid.map(f => f.name).join(', ')}`);
      e.target.value = '';
      return;
    }

    setUploadedFiles((prev) => [...prev, ...files]);
    setError(null);
  };
'@

$dsContent = $dsContent.Replace($oldUpload, $newUpload)

# Fix accept attribute
$oldAccept = 'accept="image/*,.zip,.rar"'
$newAccept = 'accept="image/*,.zip,.rar,.txt,.csv,.json,.xml,.md,.mp3,.wav,.ogg,.m4a,.aac,.flac"'
$dsContent = $dsContent.Replace($oldAccept, $newAccept)

$dsContent | Set-Content $dsPath -Encoding UTF8 -NoNewline
Write-Host "Done Manager/Datasets.jsx"
Write-Host "All done!"
