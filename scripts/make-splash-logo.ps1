Add-Type -AssemblyName System.Drawing
$srcPath = Join-Path $PSScriptRoot "..\assets\images\logo_png.png"
if (-not (Test-Path $srcPath)) {
  $srcPath = "d:\Afucent\B2B-Mobile-App\assets\images\logo_png.png"
}
$src = [System.Drawing.Image]::FromFile((Resolve-Path $srcPath))
$resRoot = "d:\Afucent\B2B-Mobile-App\android\app\src\main\res"
$map = @{
  "drawable-mdpi"    = 192
  "drawable-hdpi"    = 288
  "drawable-xhdpi"   = 384
  "drawable-xxhdpi"  = 576
  "drawable-xxxhdpi" = 768
}

foreach ($folder in $map.Keys) {
  $size = $map[$folder]
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::White)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  # Keep full logo inside Android 12 circular safe-zone (~62% width)
  $maxW = [int]($size * 0.62)
  $maxH = [int]($size * 0.30)
  $ratio = [Math]::Min($maxW / $src.Width, $maxH / $src.Height)
  $w = [Math]::Max(1, [int]($src.Width * $ratio))
  $h = [Math]::Max(1, [int]($src.Height * $ratio))
  $x = ($size - $w) / 2
  $y = ($size - $h) / 2
  $g.DrawImage($src, $x, $y, $w, $h)
  $out = Join-Path $resRoot "$folder\splashscreen_logo.png"
  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
  Write-Host "wrote $out"
}
$src.Dispose()
Write-Host "done"
