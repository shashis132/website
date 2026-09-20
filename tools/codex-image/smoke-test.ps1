<#
  Codex built-in image-generation smoke test (Windows).

  Proves, on your own machine and under your own ChatGPT login, that:
    1. The request used account-authenticated Codex.
    2. Codex's BUILT-IN image generation was actually invoked.
    3. A real image file was produced and can be opened.
    4. No separately billed image service or API key was used.
    5. No manual prompt or file transfer was needed.

  It deliberately does nothing else. If any check fails it says so and stops;
  it never substitutes an API call, a download, or a drawn placeholder.
#>

$ErrorActionPreference = 'Stop'
$Root      = Split-Path -Parent $MyInvocation.MyCommand.Path
$OutDir    = Join-Path $Root 'output'
$RunId     = Get-Date -Format 'yyyyMMdd-HHmmss'
$LogPath   = Join-Path $OutDir "smoke-$RunId.jsonl"
$ImagePath = Join-Path $OutDir "smoke-$RunId.png"

function Say  ($m) { Write-Host $m }
function Ok   ($m) { Write-Host "  [PASS] $m" -ForegroundColor Green }
function Bad  ($m) { Write-Host "  [FAIL] $m" -ForegroundColor Red }
function Info ($m) { Write-Host "  ....   $m" -ForegroundColor DarkGray }
function Die  ($m) { Write-Host ""; Write-Host "STOPPED: $m" -ForegroundColor Red; Write-Host ""
                     Read-Host "Press Enter to close"; exit 1 }

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

Say ""
Say "==============================================="
Say " Codex image-generation smoke test"
Say "==============================================="
Say ""

# ---------------------------------------------------------------- Node.js ---
Say "[1/6] Checking Node.js..."
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Die "Node.js is not installed. Install the LTS version from https://nodejs.org (click the big green LTS button, accept every default), then run this file again."
}
$nodeMajor = ((& node --version) -replace '^v','').Split('.')[0] -as [int]
if ($nodeMajor -lt 20) { Die "Node.js $(& node --version) is too old. Install the current LTS from https://nodejs.org and run this file again." }
Ok "Node.js $(& node --version)"

# ------------------------------------------------- Codex CLI (local copy) ---
Say ""
Say "[2/6] Installing the official Codex CLI (local to this folder)..."
Push-Location $Root
if (-not (Test-Path (Join-Path $Root 'package.json'))) {
  '{ "name": "codex-image-worker", "private": true }' | Set-Content -Encoding ASCII (Join-Path $Root 'package.json')
}
& npm install --no-audit --no-fund --silent '@openai/codex' 2>&1 | Out-Null
Pop-Location
$Codex = Join-Path $Root 'node_modules\.bin\codex.cmd'
if (-not (Test-Path $Codex)) { Die "The Codex CLI did not install. Check that you are online and try again." }
Info (& $Codex --version)
Ok "Official Codex CLI installed from npm (@openai/codex)"

# ------------------------------------------ Force ChatGPT auth, no API key ---
Say ""
Say "[3/6] Locking authentication to your ChatGPT account..."

# Keep any API key out of Codex's environment entirely, so an API-billed
# fallback cannot happen even silently.
$hadKeyInUserEnv = $false
foreach ($v in 'OPENAI_API_KEY','OPENAI_BASE_URL','OPENAI_ORG_ID','OPENAI_PROJECT_ID') {
  if ([Environment]::GetEnvironmentVariable($v, 'User') -or [Environment]::GetEnvironmentVariable($v, 'Machine')) { $hadKeyInUserEnv = $true }
  Remove-Item "Env:\$v" -ErrorAction SilentlyContinue
}
if ($hadKeyInUserEnv) {
  Info "An OpenAI API key exists in your Windows environment. It has been removed from THIS run only; nothing was changed permanently."
}

$env:CODEX_HOME = Join-Path $env:USERPROFILE '.codex'
New-Item -ItemType Directory -Force -Path $env:CODEX_HOME | Out-Null
$cfg = Join-Path $env:CODEX_HOME 'config.toml'
if (-not (Test-Path $cfg)) { New-Item -ItemType File -Path $cfg | Out-Null }
$cfgText = Get-Content $cfg -Raw -ErrorAction SilentlyContinue
if ($cfgText -notmatch 'preferred_auth_method') {
  Add-Content $cfg "`npreferred_auth_method = `"chatgpt`"`n"
}
Ok "Credentials will be stored in $env:CODEX_HOME (your Windows profile, not this repo)"

# ------------------------------------------------------------------ Login ---
Say ""
Say "[4/6] Checking your ChatGPT login..."
$status = (& $Codex login status 2>&1 | Out-String).Trim()
if ($status -match 'Not logged in') {
  Say ""
  Say "  You are not logged in yet. A browser window will open."
  Say "  Sign in with your normal ChatGPT account, then come back here."
  Say ""
  Read-Host "  Press Enter to open the sign-in page"
  & $Codex login
  $status = (& $Codex login status 2>&1 | Out-String).Trim()
}
if ($status -match 'Not logged in') { Die "Sign-in did not complete. Run this file again and finish the browser sign-in." }
Info $status
if ($status -match 'API key') {
  Die "Codex is authenticated with an API KEY, not your ChatGPT account. That would bill separately, which you asked to avoid. Run: codex logout, then run this file again and sign in through the browser."
}
Ok "Authenticated with a ChatGPT account (not an API key)"

# --------------------------------------------------------------- The test ---
Say ""
Say "[5/6] Asking Codex to generate one simple original image..."
Info "This is a single non-interactive run. No prompt is typed by you."

$prompt = @"
Use your BUILT-IN image generation tool to create ONE original image.

Subject: a single plain ceramic coffee mug, light steam rising, on a plain
neutral background, soft even lighting, simple and uncluttered.

Requirements:
- Use your built-in image generation capability only.
- Do NOT call any external HTTP API, do NOT use curl, and do NOT download
  any image from the internet.
- Do NOT draw or synthesise the image with code (no PIL, no ImageMagick,
  no SVG, no canvas).
- Save the generated image to exactly this path: $ImagePath
- Then reply with only the words: IMAGE SAVED
"@

$promptFile = Join-Path $OutDir "prompt-$RunId.txt"
$prompt | Set-Content -Encoding UTF8 $promptFile

& $Codex exec `
    --sandbox workspace-write `
    --skip-git-repo-check `
    --json `
    --cd $Root `
    $prompt 2>&1 | Tee-Object -FilePath $LogPath | Out-Null

if (-not (Test-Path $LogPath)) { Die "Codex produced no output log. Nothing can be verified." }

# ------------------------------------------------------------ Verification ---
Say ""
Say "[6/6] Verifying the result..."
Say ""

$log  = Get-Content $LogPath -Raw
$fail = @()

# (1) account-authenticated
Ok "1. Request ran under your ChatGPT account login (verified above, API key absent from environment)"

# (2) built-in image generation actually invoked
if ($log -match 'image_generation_call') {
  Ok "2. Codex's built-in image generation was invoked (image_generation_call present in the run log)"
} else {
  Bad "2. No built-in image-generation call appeared in the run log"
  $fail += "Codex did not invoke its built-in image generation tool."
}

# (4) no separately billed service / API key  -- checked before (3) reads the file
$billed = @()
if ($log -match 'api\.openai\.com')          { $billed += 'a direct api.openai.com call' }
if ($log -match 'OPENAI_API_KEY')            { $billed += 'an OPENAI_API_KEY reference' }
if ($log -match 'gpt-image-[0-9]')           { $billed += 'the API-billed gpt-image CLI path' }
if ($log -match '(?i)\b(curl|Invoke-WebRequest|wget)\b.*image') { $billed += 'an HTTP image download' }
if ($billed.Count -eq 0) {
  Ok "4. No separately billed image service and no API key were used"
} else {
  Bad "4. Possible separately billed path detected: $($billed -join ', ')"
  $fail += "A separately billed image path may have been used."
}

# (3) a real, openable image file
if (Test-Path $ImagePath) {
  $fi = Get-Item $ImagePath
  $fs = [System.IO.File]::OpenRead($ImagePath)
  $hdr = New-Object byte[] 24
  $null = $fs.Read($hdr, 0, 24)
  $fs.Close()
  $isPng  = $hdr[0] -eq 0x89 -and $hdr[1] -eq 0x50 -and $hdr[2] -eq 0x4E -and $hdr[3] -eq 0x47
  $isJpg  = $hdr[0] -eq 0xFF -and $hdr[1] -eq 0xD8 -and $hdr[2] -eq 0xFF
  $isWebp = $hdr[0] -eq 0x52 -and $hdr[1] -eq 0x49 -and $hdr[8] -eq 0x57 -and $hdr[9] -eq 0x45
  if (($isPng -or $isJpg -or $isWebp) -and $fi.Length -gt 10000) {
    $dims = ''
    if ($isPng) {
      $w = [int]$hdr[16]*16777216 + [int]$hdr[17]*65536 + [int]$hdr[18]*256 + [int]$hdr[19]
      $h = [int]$hdr[20]*16777216 + [int]$hdr[21]*65536 + [int]$hdr[22]*256 + [int]$hdr[23]
      $dims = " ${w}x${h}px,"
    }
    Ok ("3. A real image file was produced:{0} {1:N0} KB" -f $dims, ($fi.Length/1KB))
    Info $ImagePath
  } else {
    Bad "3. The file at the output path is not a valid image (or is suspiciously small)"
    $fail += "No valid image file was produced."
  }
} else {
  Bad "3. No image file was produced at the expected path"
  $fail += "No image file was produced."
}

# (5) no manual step
Ok "5. No manual prompt entry or file transfer was needed (one non-interactive run)"

Say ""
Say "==============================================="
if ($fail.Count -eq 0) {
  Say " RESULT: SMOKE TEST PASSED" 
  Say "==============================================="
  Say ""
  Say " Image:    $ImagePath"
  Say " Run log:  $LogPath"
  Say ""
  Say " Opening the image so you can confirm it looks right..."
  Start-Process $ImagePath
  Say ""
  Say " Tell Claude: SMOKE TEST PASSED"
} else {
  Say " RESULT: SMOKE TEST FAILED"
  Say "==============================================="
  Say ""
  foreach ($f in $fail) { Say "  - $f" }
  Say ""
  Say " Nothing was substituted or faked."
  Say " Run log (send this to Claude): $LogPath"
}
Say ""
Read-Host "Press Enter to close"
