# Reports which terminal window is in front, to the ah server (#21). Run by
# `ah focus start`, hidden; one copy per port (a mutex).
#
#   focus_win.ps1 -Port 7420 [-Once]
#
# A SetWinEventHook for foreground changes, plus a timer that reports the
# foreground window again every few seconds, so a report stays current while
# you stay in one terminal. Only windows of a terminal class report, and only
# their title is sent: to the local server, which matches it to an agent's
# session title and keeps nothing (core/focus.ts). Other windows are never
# looked at beyond their class.
#
# -Once prints the foreground window's class and whether it would report, and
# exits, for checking.

param(
  [int]$Port = 7420,
  [switch]$Once,
  # Append what the watcher sees to this file (class only, and whether it
  # reported), for finding out why a window isn't followed. No titles.
  [string]$Log
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Net.Http
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class FocusWin {
  public delegate void WinEventDelegate(IntPtr hook, uint evt, IntPtr hwnd, int idObject, int idChild, uint thread, uint time);
  [DllImport("user32.dll")] public static extern IntPtr SetWinEventHook(uint min, uint max, IntPtr mod, WinEventDelegate cb, uint pid, uint tid, uint flags);
  [DllImport("user32.dll")] public static extern bool UnhookWinEvent(IntPtr hook);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  public static WinEventDelegate Keep;
  public static string ClassOf(IntPtr h) { var s = new StringBuilder(128); GetClassName(h, s, 128); return s.ToString(); }
  public static string TitleOf(IntPtr h) { var s = new StringBuilder(512); GetWindowText(h, s, 512); return s.ToString(); }
}
"@

# Windows Terminal, and the classic console host
$terminalClasses = @("CASCADIA_HOSTING_WINDOW_CLASS", "ConsoleWindowClass")

if ($Once) {
  $h = [FocusWin]::GetForegroundWindow()
  $cls = [FocusWin]::ClassOf($h)
  Write-Output "foreground class: $cls"
  Write-Output "reports: $($terminalClasses -contains $cls)"
  exit 0
}

$mutex = New-Object System.Threading.Mutex($false, "Local\ah-focus-$Port")
if (-not $mutex.WaitOne(0)) { exit 0 }

$client = New-Object System.Net.Http.HttpClient
$client.Timeout = [TimeSpan]::FromSeconds(2)
$url = "http://127.0.0.1:$Port/core/focus"

function Write-Log([string]$line) {
  if ($Log) { Add-Content -Path $Log -Value "$([DateTime]::Now.ToString('HH:mm:ss.fff')) $line" }
}

function Send-Foreground {
  $h = [FocusWin]::GetForegroundWindow()
  if ($h -eq [IntPtr]::Zero) { Write-Log "foreground: none"; return }
  $cls = [FocusWin]::ClassOf($h)
  if ($terminalClasses -notcontains $cls) { Write-Log "foreground: $cls (not a terminal)"; return }
  Write-Log "foreground: $cls (reporting)"
  $title = [FocusWin]::TitleOf($h)
  $json = ConvertTo-Json @{ title = $title } -Compress
  $content = New-Object System.Net.Http.StringContent($json, [System.Text.Encoding]::UTF8, "application/json")
  # Not awaited: the message loop must not wait on the server
  [void]$client.PostAsync($url, $content)
}

$cb = [FocusWin+WinEventDelegate]{
  param($hook, $evt, $hwnd, $idObject, $idChild, $thread, $time)
  Send-Foreground
}
[FocusWin]::Keep = $cb
# EVENT_SYSTEM_FOREGROUND = 3, out of context (0), so no DLL is injected anywhere
$hook = [FocusWin]::SetWinEventHook(3, 3, [IntPtr]::Zero, $cb, 0, 0, 0)

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 5000
$timer.add_Tick({ Send-Foreground })
$timer.Start()

Send-Foreground
try {
  [System.Windows.Forms.Application]::Run()
} finally {
  # A leaked hook would keep the process alive
  [void][FocusWin]::UnhookWinEvent($hook)
  $mutex.ReleaseMutex()
}
