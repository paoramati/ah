# Builds ah's native window (App.cs) into webview-win\build\ah-app.exe (#27).
#
#   powershell -ExecutionPolicy Bypass -File webview-win\build.ps1 [-Force]
#
# Needs only what ships with Windows: the .NET Framework's csc.exe (C# 5) and the
# WebView2 runtime. The managed WebView2 libraries come from the pinned
# Microsoft.Web.WebView2 NuGet package, downloaded once into build\cache\ (not
# committed), checked against its SHA-512, and unpacked into a folder of its
# own. Nothing from the download runs: only its DLLs are linked and copied.
# Rebuilds when App.cs is newer than the exe, or with -Force.

param([switch]$Force)
$ErrorActionPreference = "Stop"

$version = "1.0.2592.51"
# The package's SHA-512 (base64), as published in NuGet's catalog
$sha512 = "vXojrLUFBHiEuKUsnD3+g4XSkeT4s5YRJWZCGNg6BHw/ew7aSdhyDykB+RNkW4Uio3+Z1a3/LQw0kVze7H8xeQ=="

$root = $PSScriptRoot
$build = Join-Path $root "build"
$cache = Join-Path $build "cache"
$exe = Join-Path $build "ah-app.exe"
$src = Join-Path $root "App.cs"

if (-not $Force -and (Test-Path $exe) -and ((Get-Item $exe).LastWriteTime -gt (Get-Item $src).LastWriteTime)) {
  Write-Output "up to date: $exe"
  exit 0
}

$csc = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path $csc)) { throw "csc.exe not found at $csc (the .NET Framework 4 compiler ships with Windows)" }

New-Item -ItemType Directory -Force -Path $cache | Out-Null
$zip = Join-Path $cache "microsoft.web.webview2.$version.zip"
$pkg = Join-Path $cache "pkg-$version"

if (-not (Test-Path $zip)) {
  $url = "https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/$version"
  Write-Output "downloading $url"
  Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $zip
}
$actual = [Convert]::ToBase64String([Security.Cryptography.SHA512]::Create().ComputeHash([IO.File]::ReadAllBytes($zip)))
if ($actual -ne $sha512) {
  Remove-Item -Force $zip
  throw "the WebView2 package's SHA-512 is $actual, not the pinned $sha512; deleted it"
}
if (-not (Test-Path $pkg)) { Expand-Archive -Path $zip -DestinationPath $pkg -Force }

$core = Join-Path $pkg "lib\net462\Microsoft.Web.WebView2.Core.dll"
$forms = Join-Path $pkg "lib\net462\Microsoft.Web.WebView2.WinForms.dll"
$loader = Join-Path $pkg "runtimes\win-x64\native\WebView2Loader.dll"
foreach ($f in @($core, $forms, $loader)) { if (-not (Test-Path $f)) { throw "missing in the package: $f" } }

& $csc /nologo /target:winexe /platform:x64 /optimize+ "/out:$exe" `
  /r:System.Windows.Forms.dll /r:System.Drawing.dll "/r:$core" "/r:$forms" $src
if ($LASTEXITCODE -ne 0) { throw "csc failed with exit code $LASTEXITCODE" }

Copy-Item -Force $core, $forms, $loader $build
Write-Output "built: $exe"
