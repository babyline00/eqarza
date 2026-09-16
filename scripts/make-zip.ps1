$zip = "C:\Users\musad\Downloads\E-Qarza-Deploy.zip"
$app = "C:\Users\musad\Downloads\E-Qarza-App-Ready (1)\app"
Remove-Item $zip -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
Compress-Archive -Path $app -DestinationPath $zip -CompressionLevel Optimal -Force
Get-ChildItem $zip | Select-Object Name, Length
