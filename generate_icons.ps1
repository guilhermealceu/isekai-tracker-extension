Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Net.Http

$logoUrl = 'https://runestorage.up.railway.app/uploads/logos/1772405817073-51385268.png'
$destDir = 'd:\PROJETOS\RuneExtension\icons'
$tmpFile = "$destDir\logo_tmp.png"

# Download
$client = New-Object System.Net.WebClient
$client.DownloadFile($logoUrl, $tmpFile)
Write-Host "Downloaded logo."

# Resize to each size
$sizes = @(16, 32, 48, 128)
foreach ($size in $sizes) {
    $img = [System.Drawing.Image]::FromFile($tmpFile)
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($img, 0, 0, $size, $size)
    $g.Dispose()
    $img.Dispose()
    $destPath = Join-Path $destDir ("icon" + $size + ".png")
    $bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host ("Saved icon" + $size + ".png")
}

# Cleanup
Remove-Item $tmpFile
Write-Host "Done! All icons replaced with official Rune logo."
