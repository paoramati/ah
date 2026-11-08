# The ah tray icon (Windows): server status at a glance, with a menu to open the
# tracker hub, open the server status page, restart the server, or quit.
# Run by `ah tray start`, hidden and detached; one copy at a time (a mutex).
#
#   tray.ps1 -Port 7420 -Ah <path to bin\ah.cmd> [-Once]
#
# -Once draws the icon, prints what it would show and exits, for checking.

param(
  [int]$Port = 7420,
  [string]$Ah = "ah",
  [switch]$Once
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$mutex = New-Object System.Threading.Mutex($false, "Local\ah-tray-$Port")
if (-not $Once -and -not $mutex.WaitOne(0)) { exit 0 }

# A 16x16 icon drawn here, so nothing is shipped: a filled circle, teal when the
# server is up and gray when it isn't, with a small "a"
function New-AhIcon([bool]$up) {
  $bmp = New-Object System.Drawing.Bitmap 16, 16
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $color = if ($up) { [System.Drawing.Color]::FromArgb(13, 148, 136) } else { [System.Drawing.Color]::FromArgb(120, 120, 120) }
  $brush = New-Object System.Drawing.SolidBrush $color
  $g.FillEllipse($brush, 0, 0, 15, 15)
  $font = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $g.DrawString("a", $font, [System.Drawing.Brushes]::White, 2, 0)
  $g.Dispose()
  $icon = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
  return $icon
}

# What the server says about itself, or $null if it isn't there
function Get-AhStatus {
  try {
    return Invoke-RestMethod -Uri "http://127.0.0.1:$Port/status" -TimeoutSec 2
  } catch {
    return $null
  }
}

function Format-Status($s) {
  if ($null -eq $s) { return "ah: server not running" }
  $n = [int]$s.views
  $pages = if ($n -eq 1) { "1 page open" } else { "$n pages open" }
  return "ah: running, $pages"
}

function Invoke-Ah([string[]]$ArgList) {
  Start-Process -FilePath $Ah -ArgumentList $ArgList -WindowStyle Hidden
}

if ($Once) {
  $s = Get-AhStatus
  Write-Output (Format-Status $s)
  $icon = New-AhIcon ($null -ne $s)
  Write-Output "icon $($icon.Width)x$($icon.Height)"
  exit 0
}

$notify = New-Object System.Windows.Forms.NotifyIcon
$notify.Visible = $true
$menu = New-Object System.Windows.Forms.ContextMenuStrip

$statusItem = $menu.Items.Add("ah")
$statusItem.Enabled = $false
[void]$menu.Items.Add("-")
$trackers = $menu.Items.Add("Open trackers")
$trackers.add_Click({ Invoke-Ah @("tracker", "hub", "-p", "$Port") })
$statusPage = $menu.Items.Add("Server status")
$statusPage.add_Click({ Start-Process "http://127.0.0.1:$Port/status" })
$restart = $menu.Items.Add("Restart server")
$restart.add_Click({ Invoke-Ah @("server", "restart", "-p", "$Port") })
[void]$menu.Items.Add("-")
$quit = $menu.Items.Add("Quit tray")
$quit.add_Click({
  $notify.Visible = $false
  $notify.Dispose()
  [System.Windows.Forms.Application]::Exit()
})
$notify.ContextMenuStrip = $menu
$notify.add_MouseClick({
  if ($_.Button -eq [System.Windows.Forms.MouseButtons]::Left) { Invoke-Ah @("tracker", "hub", "-p", "$Port") }
})

$script:wasUp = $null
function Update-Tray {
  $s = Get-AhStatus
  $up = $null -ne $s
  $text = Format-Status $s
  $statusItem.Text = $text
  # NotifyIcon.Text is limited to 63 characters
  $notify.Text = $text.Substring(0, [Math]::Min(63, $text.Length))
  if ($script:wasUp -ne $up) {
    $old = $notify.Icon
    $notify.Icon = New-AhIcon $up
    if ($null -ne $old) { $old.Dispose() }
    $script:wasUp = $up
  }
}

Update-Tray
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 5000
$timer.add_Tick({ Update-Tray })
$timer.Start()
[System.Windows.Forms.Application]::Run()
$mutex.ReleaseMutex()
