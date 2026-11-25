$ErrorActionPreference = 'Stop'
$sourceVault = [IO.Path]::GetFullPath('D:\Obsidian\万不言博客项目库')
$targetVault = [IO.Path]::GetFullPath('D:\Notes\万不言博客项目库')
$installRoot = [IO.Path]::GetFullPath('D:\Obsidian')
$siteRoot = Split-Path $PSScriptRoot -Parent
if ($sourceVault -ne 'D:\Obsidian\万不言博客项目库' -or $targetVault -ne 'D:\Notes\万不言博客项目库') { throw 'Unexpected migration paths.' }
if ($targetVault.StartsWith($installRoot + '\', [StringComparison]::OrdinalIgnoreCase) -or $targetVault -eq $installRoot) { throw 'Destination cannot be inside the application installation.' }
if (Test-Path -LiteralPath $targetVault) { throw 'Destination already exists; no directories were merged or overwritten.' }
$sourceItem = Get-Item -LiteralPath $sourceVault -Force
if ($sourceItem.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Source is a reparse point.' }
$identityFile = Join-Path $sourceVault '.project-memory/identity.json'
$identity = Get-Content -LiteralPath $identityFile -Raw | ConvertFrom-Json
if ($identity.identity -ne 'wanbuyan-blog-memory-v1') { throw 'Not the expected project vault.' }
$files = @(Get-ChildItem -LiteralPath $sourceVault -Recurse -File -Force)
$manifest = @($files | ForEach-Object {
  @{ path = [IO.Path]::GetRelativePath($sourceVault, $_.FullName); sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash }
})
$manifestFile = Join-Path $siteRoot '.design/qa/obsidian-relocation-manifest.json'
[IO.File]::WriteAllText($manifestFile, ($manifest | ConvertTo-Json -Depth 4), [Text.UTF8Encoding]::new($false))
New-Item -ItemType Directory -Path (Split-Path $targetVault) -Force | Out-Null
$targetParent = Get-Item -LiteralPath (Split-Path $targetVault) -Force
if ($targetParent.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Destination parent is a reparse point.' }
# Both absolute targets have been checked; only this named project directory is moved.
Move-Item -LiteralPath $sourceVault -Destination $targetVault
foreach ($entry in $manifest) {
  $movedFile = Join-Path $targetVault $entry.path
  if (!(Test-Path -LiteralPath $movedFile) -or (Get-FileHash -LiteralPath $movedFile -Algorithm SHA256).Hash -ne $entry.sha256) { throw "Migration integrity check failed: $($entry.path)" }
}
$decisions = Join-Path $targetVault '00 项目/决策与偏好.md'
$decisionText = [IO.File]::ReadAllText($decisions)
$policy = "`n`n## 笔记库位置修正`n`nObsidian 安装在 D:\Obsidian，笔记库不得放在该安装目录内。项目库已迁移到 D:\Notes\万不言博客项目库。测试库 D:\Obsidian\1 不使用、不移动。`n"
if (!$decisionText.Contains('## 笔记库位置修正')) {
  $backupDir = Join-Path $targetVault '.project-memory/backups'
  New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
  $backup = @{ reason = 'record vault location correction'; file = '00 项目/决策与偏好.md'; content = $decisionText }
  [IO.File]::WriteAllText((Join-Path $backupDir 'vault-location-correction.json'), ($backup | ConvertTo-Json -Depth 4), [Text.UTF8Encoding]::new($false))
  [IO.File]::WriteAllText($decisions, $decisionText + $policy, [Text.UTF8Encoding]::new($false))
}
Write-Output "Moved $($manifest.Count) files to $targetVault; every original file passed SHA-256 verification before recording the correction."
