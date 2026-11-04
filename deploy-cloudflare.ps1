param(
  [string]$AccountId = "",
  [string]$ScriptName = "ulsan-soccer-reservation-checker"
)
$ErrorActionPreference = "Stop"
$previousAccount = $env:CLOUDFLARE_ACCOUNT_ID
Push-Location $PSScriptRoot
try {
  if ($AccountId) { $env:CLOUDFLARE_ACCOUNT_ID = $AccountId }
  & node --test tests/reservations.test.mjs
  if ($LASTEXITCODE -ne 0) { throw "Reservation tests failed; deployment stopped." }
  & npx.cmd --yes wrangler@4.157.0 deploy --dry-run --name $ScriptName
  if ($LASTEXITCODE -ne 0) { throw "Worker validation failed; deployment stopped." }
  & npx.cmd --yes wrangler@4.157.0 deploy --name $ScriptName
  if ($LASTEXITCODE -ne 0) { throw "Deployment failed. Check Wrangler authentication and account selection." }
} finally {
  $env:CLOUDFLARE_ACCOUNT_ID = $previousAccount
  Pop-Location
}
