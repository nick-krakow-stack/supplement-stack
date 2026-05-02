$env:CLOUDFLARE_API_TOKEN = "paste-project-specific-token-here"
$env:CLOUDFLARE_ACCOUNT_ID = "paste-project-account-id-here"

Write-Host "Supplement Stack Cloudflare context loaded." -ForegroundColor Green
Write-Host "Project-specific Cloudflare environment variables are set."
Write-Host ""
Write-Host "Useful commands:"
Write-Host "  npx wrangler whoami"
Write-Host "  npx wrangler d1 migrations apply supplementstack-production --remote"
Write-Host "  npx wrangler pages deploy frontend/dist --project-name supplementstack"
