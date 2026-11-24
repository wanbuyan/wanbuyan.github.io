param(
  [string]$Source = 'posts/files/DC-2靶场全流程——万不言.docx',
  [string]$ImageFolder = 'posts/images/dc2',
  [string]$Output = '.design/qa/dc2-extracted.json'
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$siteRoot = Split-Path $PSScriptRoot -Parent
$sourcePath = Join-Path $siteRoot $Source
$imageDir = Join-Path $siteRoot $ImageFolder
$outputPath = Join-Path $siteRoot $Output
New-Item -ItemType Directory -Force -Path $imageDir, (Split-Path $outputPath) | Out-Null
$archive = [IO.Compression.ZipFile]::OpenRead($sourcePath)
try {
  function Read-ArchiveXml([string]$Name) {
    $reader = [IO.StreamReader]::new($archive.GetEntry($Name).Open())
    try { return [xml]$reader.ReadToEnd() } finally { $reader.Dispose() }
  }
  $document = Read-ArchiveXml 'word/document.xml'
  $relationships = Read-ArchiveXml 'word/_rels/document.xml.rels'
  $relationshipMap = @{}
  foreach ($relationship in $relationships.DocumentElement.ChildNodes) {
    if ($relationship.TargetMode -ne 'External') { $relationshipMap[$relationship.Id] = $relationship.Target }
  }
  $namespaces = [Xml.XmlNamespaceManager]::new($document.NameTable)
  $namespaces.AddNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main')
  $namespaces.AddNamespace('a', 'http://schemas.openxmlformats.org/drawingml/2006/main')
  $namespaces.AddNamespace('r', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
  $imageMap = @{}
  $paragraphs = [Collections.Generic.List[object]]::new()
  $index = 0
  foreach ($paragraph in $document.SelectNodes('//w:body//w:p', $namespaces)) {
    $parts = [Collections.Generic.List[object]]::new()
    $text = [Text.StringBuilder]::new()
    foreach ($node in $paragraph.SelectNodes('.//w:t | .//w:tab | .//w:br | .//a:blip', $namespaces)) {
      if ($node.LocalName -eq 'blip') {
        if ($text.Length) { $parts.Add(@{ type = 'text'; text = $text.ToString() }); $text.Clear() | Out-Null }
        $id = $node.GetAttribute('embed', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships')
        $target = $relationshipMap[$id]
        if (!$target) { throw "No embedded image for relationship $id" }
        if (!$imageMap.ContainsKey($target)) {
          $entry = $archive.GetEntry('word/' + $target)
          if (!$entry) { throw "Image entry missing: $target" }
          $fileName = 'screenshot-{0:D2}{1}' -f ($imageMap.Count + 1), [IO.Path]::GetExtension($entry.FullName)
          $imagePath = Join-Path $imageDir $fileName
          [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $imagePath, $true)
          $imageMap[$target] = "$($ImageFolder.Replace('\','/'))/$fileName"
        }
        $parts.Add(@{ type = 'image'; src = $imageMap[$target] })
      } elseif ($node.LocalName -eq 'tab') { $text.Append("`t") | Out-Null
      } elseif ($node.LocalName -eq 'br') { $text.Append("`n") | Out-Null
      } else { $text.Append($node.InnerText) | Out-Null }
    }
    if ($text.Length) { $parts.Add(@{ type = 'text'; text = $text.ToString() }) }
    if ($parts.Count) { $paragraphs.Add(@{ index = $index; parts = $parts.ToArray() }) }
    $index++
  }
  $result = @{ paragraphs = $paragraphs.ToArray(); imageCount = $imageMap.Count; source = $Source }
  [IO.File]::WriteAllText($outputPath, ($result | ConvertTo-Json -Depth 8), [Text.UTF8Encoding]::new($false))
  Write-Output "Extracted $($paragraphs.Count) paragraphs and $($imageMap.Count) original images."
} finally { $archive.Dispose() }
