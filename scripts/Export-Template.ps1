[CmdletBinding()]
param(
    [string]$Destination,
    [switch]$Zip
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$rootPath = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
& (Join-Path $PSScriptRoot 'Test-Template.ps1') -Root $rootPath
if ([string]::IsNullOrWhiteSpace($Destination)) {
    $Destination = Join-Path $rootPath '.artifacts/rex-project-template'
}
$destinationPath = [IO.Path]::GetFullPath($Destination)
$rootPrefix = $rootPath.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
$destinationPrefix = $destinationPath.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
if ($destinationPath.Equals($rootPath, [StringComparison]::OrdinalIgnoreCase) -or
    $rootPath.StartsWith($destinationPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'The export destination cannot be the source directory or an ancestor of it.'
}
if ($destinationPath.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    $allowedPrefix = (Join-Path $rootPath '.artifacts').TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
    if (-not $destinationPath.StartsWith($allowedPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Exports inside the source workspace must go under .artifacts.'
    }
}
$probe = $destinationPath
while (-not [string]::IsNullOrWhiteSpace($probe)) {
    if (Test-Path -LiteralPath $probe) {
        if ((Get-Item -LiteralPath $probe -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {
            throw "Export destination passes through a symbolic link or reparse point: $probe"
        }
    }
    $parent = Split-Path -Parent $probe
    if ($parent -eq $probe) { break }
    $probe = $parent
}
if (Test-Path -LiteralPath $destinationPath) {
    if (-not (Test-Path -LiteralPath $destinationPath -PathType Container) -or
        @(Get-ChildItem -LiteralPath $destinationPath -Force).Count -gt 0) {
        throw 'Export destination already exists and is not an empty directory. Choose a new destination.'
    }
}
$archivePath = "$destinationPath.zip"
if ($Zip -and (Test-Path -LiteralPath $archivePath)) { throw "Archive already exists: $archivePath" }
$null = New-Item -ItemType Directory -Path $destinationPath -Force
$manifest = Get-Content -LiteralPath (Join-Path $rootPath 'template.manifest.json') -Raw | ConvertFrom-Json
foreach ($relative in $manifest.paths) {
    $source = Join-Path $rootPath $relative
    $target = Join-Path $destinationPath $relative
    $null = New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force
    Copy-Item -LiteralPath $source -Destination $target
}
& (Join-Path $destinationPath 'scripts/Test-Template.ps1') -Root $destinationPath
if ($Zip) {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [IO.Compression.ZipFile]::CreateFromDirectory($destinationPath, $archivePath)
    Write-Host "Archive: $archivePath"
}
Write-Host "Clean template: $destinationPath"
