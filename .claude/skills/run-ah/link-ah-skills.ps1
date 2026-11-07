# Sets a project up for ah on purpose: links ah's markdown, html and tracker skills into the
# project's .claude\skills as junctions (loaded by Claude sessions started in that project only).
# Nothing global changes. Restart the Claude session in the project afterwards.
#
#   powershell -ExecutionPolicy Bypass -File link-ah-skills.ps1 -Project C:\projects\my-app
#   powershell -ExecutionPolicy Bypass -File link-ah-skills.ps1 -Project C:\projects\my-app -Remove
#
# -Remove deletes only the three junctions, never the ah repo's folders.
param(
  [Parameter(Mandatory = $true)][string]$Project,
  [string]$Repo = 'C:\projects\ah',
  [switch]$Remove
)

$names = 'markdown', 'html', 'tracker'
$project = (Resolve-Path $Project).Path
$dest = Join-Path $project '.claude\skills'

if ($Remove) {
  foreach ($n in $names) {
    $link = Join-Path $dest $n
    $item = Get-Item $link -ErrorAction SilentlyContinue
    if ($item -and $item.LinkType -eq 'Junction') { $item.Delete(); "removed $link" }
    elseif ($item) { "skipped $link (not a junction, left alone)" }
  }
  return
}

foreach ($n in $names) {
  $target = Join-Path $Repo "skills\$n"
  if (-not (Test-Path (Join-Path $target 'SKILL.md'))) { throw "ah skill not found: $target" }
}
New-Item -ItemType Directory -Force $dest | Out-Null
foreach ($n in $names) {
  $link = Join-Path $dest $n
  if (Test-Path $link) { "exists, left alone: $link"; continue }
  New-Item -ItemType Junction -Path $link -Target (Join-Path $Repo "skills\$n") | Out-Null
  "linked $link"
}
"Done. Start a NEW Claude session in $project so the skills load."
