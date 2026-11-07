# Applies runbook phases 3 and 5 for ah on Windows. Review before running.
#   1. Adds <repo>\bin to the USER PATH (if missing)
#   2. Backs up ~/.claude/settings.json to settings.json.bak-ah
#   3. Adds the ah hook to SessionStart, UserPromptSubmit, Stop and SessionEnd (existing hooks kept)
#   4. Sets crossSessionInbound = accept
# Run: powershell -ExecutionPolicy Bypass -File apply-ah-config.ps1 [-Repo C:\projects\ah]
# Undo: Copy-Item settings.json.bak-ah settings.json -Force; remove the PATH entry.
param([string]$Repo = 'C:\projects\ah')

$bin = Join-Path $Repo 'bin'
$p = [Environment]::GetEnvironmentVariable('Path', 'User')
if (($p -split ';') -notcontains $bin) {
  [Environment]::SetEnvironmentVariable('Path', ($p.TrimEnd(';') + ';' + $bin), 'User')
  'PATH: added ' + $bin
} else { 'PATH: already there' }

$s = Join-Path $env:USERPROFILE '.claude\settings.json'
Copy-Item $s "$s.bak-ah" -Force
$j = Get-Content $s -Raw | ConvertFrom-Json
$cmd = @{ hooks = @(@{ type = 'command'; command = 'ah hook agent --harness claude' }) }
foreach ($e in 'SessionStart', 'UserPromptSubmit', 'Stop', 'SessionEnd') {
  $j.hooks | Add-Member -NotePropertyName $e -NotePropertyValue @($cmd) -Force
}
$j | Add-Member -NotePropertyName crossSessionInbound -NotePropertyValue 'accept' -Force
# Windows PowerShell 5.1's Set-Content -Encoding utf8 writes a BOM; write without one
[IO.File]::WriteAllText($s, ($j | ConvertTo-Json -Depth 12), (New-Object Text.UTF8Encoding($false)))
$check = Get-Content $s -Raw | ConvertFrom-Json
'hooks: ' + (($check.hooks.PSObject.Properties.Name) -join ', ')
'crossSessionInbound: ' + $check.crossSessionInbound
'Open a NEW Claude session (PATH and hooks load at start).'
