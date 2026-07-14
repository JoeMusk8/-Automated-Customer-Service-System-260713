param([Parameter(Mandatory = $true)][string]$SourcePath)
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

function Env-Line([string]$Name, [string]$Value) {
  return "$Name=$($Value | ConvertTo-Json -Compress)"
}

if (-not (Test-Path -LiteralPath $SourcePath)) { throw "Credential source file not found" }
$sourceText = [IO.File]::ReadAllText($SourcePath)
$source = Read-KeyValues $sourceText
$existing = @{}
$envPath = Join-Path (Get-Location) ".env.local"
if (Test-Path -LiteralPath $envPath) {
  $existing = Read-KeyValues ([IO.File]::ReadAllText($envPath))
}
if ([string]::IsNullOrWhiteSpace($source.KISSLY_PASSWORD) -and $existing.MAIL_KISSLY_PASSWORD) {
  try { $source.KISSLY_PASSWORD = $existing.MAIL_KISSLY_PASSWORD | ConvertFrom-Json } catch { $source.KISSLY_PASSWORD = $existing.MAIL_KISSLY_PASSWORD.Trim('"') }
}
$required = @("XJOY_ACCOUNT", "XJOY_PASSWORD", "KISSLY_ACCOUNT", "KISSLY_PASSWORD")
foreach ($name in $required) {
  if (-not $source.ContainsKey($name) -or [string]::IsNullOrWhiteSpace($source[$name])) {
    throw "Credential field $name is missing or empty"
  }
}
if ($source.XJOY_ACCOUNT -ne "business@xjoy.ai" -or $source.KISSLY_ACCOUNT -ne "business@kissly.ai") {
  throw "Credential accounts do not match the configured customer-service mailboxes"
}

function Value-Or([string]$Name, [string]$Fallback) {
  if ($source.ContainsKey($Name) -and -not [string]::IsNullOrWhiteSpace($source[$Name])) {
    return $source[$Name].Trim()
  }
  return $Fallback
}

$xjoyImapHost = Value-Or "XJOY_IMAP_HOST" "us3.imap.mailhostbox.com"
$xjoyImapPort = Value-Or "XJOY_IMAP_PORT" "993"
$xjoySmtpHost = Value-Or "XJOY_SMTP_HOST" "us3.smtp.mailhostbox.com"
$xjoySmtpPort = Value-Or "XJOY_SMTP_PORT" "587"
$kisslyImapHost = Value-Or "KISSLY_IMAP_HOST" "mail.emb666.com"
$kisslyImapPort = Value-Or "KISSLY_IMAP_PORT" "993"
$kisslySmtpHost = Value-Or "KISSLY_SMTP_HOST" "mail.emb666.com"
$kisslySmtpPort = Value-Or "KISSLY_SMTP_PORT" "587"

$readToken = if ($existing.MAIL_READ_API_TOKEN) { $existing.MAIL_READ_API_TOKEN.Trim('"') } else { New-SecureToken }
$sendToken = if ($existing.MAIL_SEND_API_TOKEN) { $existing.MAIL_SEND_API_TOKEN.Trim('"') } else { New-SecureToken }

$lines = @(
  Env-Line "MAIL_XJOY_USER" $source.XJOY_ACCOUNT
  Env-Line "MAIL_XJOY_PASSWORD" $source.XJOY_PASSWORD
  Env-Line "MAIL_XJOY_IMAP_HOST" $xjoyImapHost
  "MAIL_XJOY_IMAP_PORT=$xjoyImapPort"
  "MAIL_XJOY_IMAP_SECURE=$(if ([int]$xjoyImapPort -eq 993) {'true'} else {'false'})"
  Env-Line "MAIL_XJOY_SMTP_HOST" $xjoySmtpHost
  "MAIL_XJOY_SMTP_PORT=$xjoySmtpPort"
  "MAIL_XJOY_SMTP_SECURE=$(if ([int]$xjoySmtpPort -eq 465) {'true'} else {'false'})"
  Env-Line "MAIL_KISSLY_USER" $source.KISSLY_ACCOUNT
  Env-Line "MAIL_KISSLY_PASSWORD" $source.KISSLY_PASSWORD
  Env-Line "MAIL_KISSLY_IMAP_HOST" $kisslyImapHost
  "MAIL_KISSLY_IMAP_PORT=$kisslyImapPort"
  "MAIL_KISSLY_IMAP_SECURE=$(if ([int]$kisslyImapPort -eq 993) {'true'} else {'false'})"
  Env-Line "MAIL_KISSLY_SMTP_HOST" $kisslySmtpHost
  "MAIL_KISSLY_SMTP_PORT=$kisslySmtpPort"
  "MAIL_KISSLY_SMTP_SECURE=$(if ([int]$kisslySmtpPort -eq 465) {'true'} else {'false'})"
  Env-Line "MAIL_READ_API_TOKEN" $readToken
  Env-Line "MAIL_SEND_API_TOKEN" $sendToken
)

[IO.File]::WriteAllText((Join-Path (Get-Location) ".mail-secrets.local"), $sourceText, [Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText($envPath, ($lines -join "`r`n") + "`r`n", [Text.UTF8Encoding]::new($false))
Write-Output "Imported two mailbox configurations locally without displaying values"
