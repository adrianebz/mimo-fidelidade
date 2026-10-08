Add-Type -AssemblyName System.Drawing

$sourcePath = Join-Path $PSScriptRoot "..\android_native\ic_launcher-master.png"
$targetPath = Join-Path $PSScriptRoot "..\ios\App\App\Assets.xcassets\AppIcon.appiconset\AppIcon-512@2x.png"

Write-Host "Lendo imagem de origem: $sourcePath"
$sourceImg = [System.Drawing.Image]::FromFile($sourcePath)

$newWidth = 1024
$newHeight = 1024

# Format24bppRgb garante que NÃO haverá canal Alpha (transparência), exigência estrita da Apple para ícones da App Store
$targetBitmap = New-Object System.Drawing.Bitmap($newWidth, $newHeight, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$graphics = [System.Drawing.Graphics]::FromImage($targetBitmap)

$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

# Preenche com fundo preto antes de desenhar (fundo do logo Boomii)
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::Black)
$graphics.FillRectangle($brush, 0, 0, $newWidth, $newHeight)
$brush.Dispose()

# Desenha a imagem redimensionada para exatamente 1024x1024
$destRect = New-Object System.Drawing.Rectangle(0, 0, $newWidth, $newHeight)
$srcRect = New-Object System.Drawing.Rectangle(0, 0, $sourceImg.Width, $sourceImg.Height)
$graphics.DrawImage($sourceImg, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

$graphics.Dispose()
$sourceImg.Dispose()

# Salva diretamente no caminho do AppIcon
if (Test-Path $targetPath) {
    Remove-Item $targetPath -Force
}

$targetBitmap.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
$targetBitmap.Dispose()
Write-Host "Ícone gerado com sucesso em: $targetPath"

# Também gerar as telas de Splash (Splash.imageset) com o logo Boomii centralizado em fundo preto
$splashDir = Join-Path $PSScriptRoot "..\ios\App\App\Assets.xcassets\Splash.imageset"
if (Test-Path $splashDir) {
    Write-Host "Gerando Splash screens (2732x2732) com logo Boomii..."
    $splashSize = 2732
    $splashBitmap = New-Object System.Drawing.Bitmap($splashSize, $splashSize, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $splashG = [System.Drawing.Graphics]::FromImage($splashBitmap)
    $splashG.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    
    $blackBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::Black)
    $splashG.FillRectangle($blackBrush, 0, 0, $splashSize, $splashSize)
    $blackBrush.Dispose()
    
    # Desenhar o logo centralizado (tamanho 800x800)
    $logoSize = 800
    $logoX = [int](($splashSize - $logoSize) / 2)
    $logoY = [int](($splashSize - $logoSize) / 2)
    $destLogoRect = New-Object System.Drawing.Rectangle($logoX, $logoY, $logoSize, $logoSize)
    $srcLogoRect = New-Object System.Drawing.Rectangle(0, 0, $sourceImg.Width, $sourceImg.Height)
    $sourceImg2 = [System.Drawing.Image]::FromFile($sourcePath)
    $splashG.DrawImage($sourceImg2, $destLogoRect, $srcLogoRect, [System.Drawing.GraphicsUnit]::Pixel)
    $sourceImg2.Dispose()
    $splashG.Dispose()
    
    $splashFiles = @("splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png")
    foreach ($file in $splashFiles) {
        $destFile = Join-Path $splashDir $file
        $splashBitmap.Save($destFile, [System.Drawing.Imaging.ImageFormat]::Png)
        Write-Host "Splash salvo em: $destFile"
    }
    $splashBitmap.Dispose()
}
