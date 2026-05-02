Write-Host "Installing frontend dependencies..." -ForegroundColor Cyan
Push-Location frontend
npm install
Pop-Location

Write-Host "Installing functions dependencies..." -ForegroundColor Cyan
Push-Location functions
npm install
Pop-Location

Write-Host ""
Write-Host "Local setup complete." -ForegroundColor Green
Write-Host "Start frontend: cd frontend; npm run dev"
Write-Host "Cloudflare commands: . .\scripts\use-supplementstack-cloudflare.local.ps1"
