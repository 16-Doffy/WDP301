$path = 'd:\Desktop\WDP\WDP301\frontend\src\pages\Manager\ProjectDetail.jsx'
$content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)

$old = @'
                  ) : item.mediaType === 'audio' ? (
                    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                      <Typography sx={{ color: '#f472b6', fontSize: 32 }}>??</Typography>
                      <Typography sx={{ color: '#94a3b8', fontSize: 12, px: 1, textAlign: 'center' }}>
                        {item.fileName}
                      </Typography>
                    </Box>
                  ) : item.mediaType === 'text' ? (
                    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                      <Typography sx={{ color: '#60a5fa', fontSize: 32 }}>??</Typography>
                      <Typography sx={{ color: '#94a3b8', fontSize: 12, px: 1, textAlign: 'center' }}>
                        {item.fileName}
                      </Typography>
                    </Box>
                  ) : (
                    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography sx={{ color: '#64748b' }}>No Preview</Typography>
                    </Box>
                  )}
'@

$new = @'
                  ) : item.mediaType === 'audio' ? (
                    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: '#1e293b', gap: 0.5, px: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, height: 28 }}>
                        {[3, 5, 7, 4, 9, 6, 8, 5, 3, 7, 4, 6].map((h, bi) => (
                          <Box key={bi} sx={{ width: 3, height: h, bgcolor: '#f472b6', borderRadius: 1, opacity: 0.6 + (bi % 3) * 0.15 }} />
                        ))}
                      </Box>
                      <AudioIcon sx={{ color: '#f472b6', fontSize: 20 }} />
                      <Typography sx={{ color: '#94a3b8', fontSize: 10, textAlign: 'center', fontWeight: 600 }}>Audio</Typography>
                      <Typography sx={{ color: '#64748b', fontSize: 9, textAlign: 'center', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.fileName}</Typography>
                      {(() => { const chips = item.annotatorLabels.flatMap(al => al.labels || []).filter((l, i, arr) => arr.indexOf(l) === i); const hasLabels = chips.length > 0; return hasLabels ? (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.3, justifyContent: 'center', mt: 0.5 }}>
                          {chips.slice(0, 3).map((chip, ci) => (
                            <Chip key={ci} label={chip} size="small" sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700, bgcolor: 'rgba(244,114,182,0.3)', color: '#f472b6', '& .MuiChip-label': { px: 0.5 } }} />
                          ))}
                        </Box>
                      ) : null; })()}
                    </Box>
                  ) : item.mediaType === 'text' ? (
                    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: '#1e293b', gap: 0.5, px: 1 }}>
                      <TextIcon sx={{ color: '#60a5fa', fontSize: 28 }} />
                      <Typography sx={{ color: '#94a3b8', fontSize: 10, textAlign: 'center', fontWeight: 600 }}>Text</Typography>
                      <Typography sx={{ color: '#64748b', fontSize: 9, textAlign: 'center', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.fileName}</Typography>
                      {(() => { const chips = item.annotatorLabels.flatMap(al => al.labels || []).filter((l, i, arr) => arr.indexOf(l) === i); const hasLabels = chips.length > 0; return hasLabels ? (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.3, justifyContent: 'center', mt: 0.5 }}>
                          {chips.slice(0, 2).map((chip, ci) => (
                            <Chip key={ci} label={chip} size="small" sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700, bgcolor: 'rgba(96,165,250,0.3)', color: '#60a5fa', '& .MuiChip-label': { px: 0.5 } }} />
                          ))}
                        </Box>
                      ) : null; })()}
                    </Box>
                  ) : (
                    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: '#1e293b', gap: 0.5 }}>
                      <ImageIcon sx={{ color: '#64748b', fontSize: 28 }} />
                      <Typography sx={{ color: '#64748b', fontSize: 10 }}>No Preview</Typography>
                    </Box>
                  )}
'@

if ($content.Contains($old)) {
    Write-Output "Found old string, replacing..."
    $content = $content.Replace($old, $new)
    [System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
    Write-Output "Done!"
} else {
    Write-Output "Old string NOT found. Checking for partial match..."
    if ($content.Contains("item.mediaType === 'audio'")) {
        Write-Output "Found 'audio' mediaType check in file"
    }
    if ($content.Contains('fontSize: 32')) {
        Write-Output "Found 'fontSize: 32' in file"
    }
}
