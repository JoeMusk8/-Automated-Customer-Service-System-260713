param([switch]$LocalOnly)
$ErrorActionPreference = "Stop"

function Read-KeyValues([string]$Text) {
  $values = @{}
  foreach ($line in ($Text -split "`r?`n")) {
    if ($line -match '^\s*([^#][^=]*)=(.*)$') {
      $values[$matches[1].Trim()] = $matches[2]
    }
  }
  return $values
}

function New-SecureToken {
  $bytes = [byte[]]::new(48)
  $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
  return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function Format-EnvLine([string]$Name, [string]$Value) {
  return "$Name=$($Value | ConvertTo-Json -Compress)"
}

function Add-VercelSecret([string]$Name, [string]$Value) {
  $psi = [Diagnostics.ProcessStartInfo]::new()
  $psi.FileName = "cmd.exe"
  $psi.Arguments = "/d /s /c `"vercel.cmd env add $Name production --sensitive --force --yes --no-color`""
  $psi.WorkingDirectory = (Get-Location).Path
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $psi.RedirectStandardInput = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true

  $process = [Diagnostics.Process]::Start($psi)
  $process.StandardInput.Write($Value)
  $process.StandardInput.Close()
  $stdout = $process.StandardOutput.ReadToEnd()
  $stderr = $process.StandardError.ReadToEnd()
  $process.WaitForExit()

  if ($process.ExitCode -ne 0) {
    throw "Vercel rejected $Name. $stdout $stderr"
  }
  Write-Output "Added $Name to Vercel Production"
}

$values = Read-KeyValues (Get-Clipboard -Raw)
$clipboardText = Get-Clipboard -Raw
if (-not $values.ContainsKey("MAIL_XJOY_USER") -and $clipboardText -match '(?i)business@xjoy\.ai') {
  $values.MAIL_XJOY_USER = "business@xjoy.ai"
}
$required = @("MAIL_XJOY_USER", "MAIL_XJOY_PASSWORD", "MAIL_KISSLY_USER", "MAIL_KISSLY_PASSWORD")
foreach ($name in $required) {
  if (-not $values.ContainsKey($name) -or [string]::IsNullOrWhiteSpace($values[$name])) {
    throw "Clipboard field $name is missing or empty"
  }
}
if ($values.MAIL_XJOY_USER -ne "business@xjoy.ai" -or $values.MAIL_KISSLY_USER -ne "business@kissly.ai") {
  throw "Mailbox account names do not match the two configured customer-service addresses"
}

$values.MAIL_READ_API_TOKEN = New-SecureToken
$values.MAIL_SEND_API_TOKEN = New-SecureToken

$localLines = @(
  Format-EnvLine "MAIL_XJOY_USER" $values.MAIL_XJOY_USER
  Format-EnvLine "MAIL_XJOY_PASSWORD" $values.MAIL_XJOY_PASSWORD
  "MAIL_XJOY_IMAP_HOST=imap.mailhostbox.com"
  "MAIL_XJOY_IMAP_PORT=993"
  "MAIL_XJOY_IMAP_SECURE=true"
  "MAIL_XJOY_SMTP_HOST=smtp.mailhostbox.com"
  "MAIL_XJOY_SMTP_PORT=587"
  "MAIL_XJOY_SMTP_SECURE=false"
  Format-EnvLine "MAIL_KISSLY_USER" $values.MAIL_KISSLY_USER
  Format-EnvLine "MAIL_KISSLY_PASSWORD" $values.MAIL_KISSLY_PASSWORD
  "MAIL_KISSLY_IMAP_HOST=mail.emb666.com"
  "MAIL_KISSLY_IMAP_PORT=993"
  "MAIL_KISSLY_IMAP_SECURE=true"
  "MAIL_KISSLY_SMTP_HOST=mail.emb666.com"
  "MAIL_KISSLY_SMTP_PORT=587"
  "MAIL_KISSLY_SMTP_SECURE=false"
  Format-EnvLine "MAIL_READ_API_TOKEN" $values.MAIL_READ_API_TOKEN
  Format-EnvLine "MAIL_SEND_API_TOKEN" $values.MAIL_SEND_API_TOKEN
)
[IO.File]::WriteAllText((Join-Path (Get-Location) ".env.local"), ($localLines -join "`r`n") + "`r`n", [Text.UTF8Encoding]::new($false))
Write-Output "Created local .env.local"

foreach ($name in @("MAIL_XJOY_USER", "MAIL_XJOY_PASSWORD", "MAIL_KISSLY_USER", "MAIL_KISSLY_PASSWORD", "MAIL_READ_API_TOKEN", "MAIL_SEND_API_TOKEN")) {
  if (-not $LocalOnly) {
    Add-VercelSecret $name $values[$name]
  }
}

if ($LocalOnly) {
  Set-Clipboard -Value " "
  Write-Output "Local mail secrets configured; clipboard cleared"
} else {
  Write-Output "Mail secrets configured without displaying values"
}
