param(
  [string]$AccountId = "087e277bf2acece068f4ca408b0f6dbf",
  [string]$ScriptName = "ulsan-soccer-reservation-checker"
)

$ErrorActionPreference = "Stop"

if (-not $AccountId) {
  $AccountId = Read-Host "Cloudflare Account ID"
}

$token = Read-Host "Cloudflare API Token (Workers Scripts:Edit 권한 필요)"
if (-not $token) {
  throw "Cloudflare API Token is required."
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$workerPath = Join-Path $root "cloudflare-worker.js"
if (-not (Test-Path -LiteralPath $workerPath)) {
  throw "cloudflare-worker.js not found at $workerPath"
}

$workerCode = [System.IO.File]::ReadAllText($workerPath, [System.Text.Encoding]::UTF8)
$metadataJson = '{"main_module":"cloudflare-worker.js","bindings":[]}'
$boundary = "----codex-cloudflare-" + [Guid]::NewGuid().ToString("N")
$newline = "`r`n"

function Add-PartText {
  param(
    [System.IO.MemoryStream]$Stream,
    [string]$Name,
    [string]$ContentType,
    [string]$Text,
    [string]$FileName = $null
  )

  $disposition = "Content-Disposition: form-data; name=`"$Name`""
  if ($FileName) {
    $disposition += "; filename=`"$FileName`""
  }

  $header = "--$boundary$newline$disposition$newline"
  if ($ContentType) {
    $header += "Content-Type: $ContentType$newline"
  }
  $header += $newline

  $bytes = [System.Text.Encoding]::UTF8.GetBytes($header + $Text + $newline)
  $Stream.Write($bytes, 0, $bytes.Length)
}

$body = New-Object System.IO.MemoryStream
Add-PartText -Stream $body -Name "metadata" -ContentType "application/json" -Text $metadataJson
Add-PartText -Stream $body -Name "cloudflare-worker.js" -ContentType "application/javascript+module" -Text $workerCode -FileName "cloudflare-worker.js"
$endBytes = [System.Text.Encoding]::UTF8.GetBytes("--$boundary--$newline")
$body.Write($endBytes, 0, $endBytes.Length)
$body.Position = 0

$headers = @{
  Authorization = "Bearer $token"
}

$uploadUrl = "https://api.cloudflare.com/client/v4/accounts/$AccountId/workers/scripts/$ScriptName"
$client = New-Object System.Net.Http.HttpClient
$client.DefaultRequestHeaders.Authorization = New-Object System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", $token)

try {
  $content = New-Object System.Net.Http.StreamContent($body)
  $content.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse("multipart/form-data; boundary=$boundary")
  $response = $client.PutAsync($uploadUrl, $content).GetAwaiter().GetResult()
  $responseText = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
  if (-not $response.IsSuccessStatusCode) {
    throw "Upload failed ($([int]$response.StatusCode)): $responseText"
  }

  Write-Host "Worker script uploaded."

  $subdomainUrl = "https://api.cloudflare.com/client/v4/accounts/$AccountId/workers/scripts/$ScriptName/subdomain"
  $jsonContent = New-Object System.Net.Http.StringContent('{"enabled":true}', [System.Text.Encoding]::UTF8, "application/json")
  $subdomainResponse = $client.PostAsync($subdomainUrl, $jsonContent).GetAwaiter().GetResult()
  $subdomainText = $subdomainResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult()
  if (-not $subdomainResponse.IsSuccessStatusCode) {
    $jsonContent = New-Object System.Net.Http.StringContent('{"enabled":true}', [System.Text.Encoding]::UTF8, "application/json")
    $subdomainResponse = $client.PutAsync($subdomainUrl, $jsonContent).GetAwaiter().GetResult()
    $subdomainText = $subdomainResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult()
  }

  if (-not $subdomainResponse.IsSuccessStatusCode) {
    Write-Warning "Worker uploaded, but workers.dev enable failed ($([int]$subdomainResponse.StatusCode)): $subdomainText"
    Write-Host "Open Cloudflare dashboard and enable the workers.dev route for $ScriptName."
  } else {
    Write-Host "workers.dev route enabled."
  }

  Write-Host ""
  Write-Host "Expected URL:"
  Write-Host "https://$ScriptName.gimyejun978.workers.dev"
} finally {
  $client.Dispose()
  $body.Dispose()
}
