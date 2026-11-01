[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9-]*/[A-Za-z0-9_.-]+$')]
    [string]$Repository,
    [switch]$MarkAsTemplate,
    [switch]$Apply
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$configPath = Join-Path (Split-Path -Parent $PSScriptRoot) 'config/github-labels.json'
$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
if ($config.schemaVersion -ne 1) { throw 'Unsupported label configuration version.' }

Write-Host "Repository: $Repository"
foreach ($label in $config.labels) { Write-Host "Ensure label $($label.name), color $($label.color): $($label.description)" }
if ($MarkAsTemplate) { Write-Host 'Mark this existing repository as a template.' }
if (-not $Apply) {
    Write-Host 'Preview only. Re-run with -Apply to perform these changes.'
    return
}
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw 'Install GitHub CLI and authenticate before applying.' }

function Invoke-Gh {
    param([string[]]$Arguments)
    $output = & gh @Arguments
    if ($LASTEXITCODE -ne 0) { throw "GitHub CLI failed with exit code $LASTEXITCODE. Review its error before retrying." }
    return $output
}

$metadata = Invoke-Gh -Arguments @('api', "repos/$Repository", '--hostname', 'github.com') | ConvertFrom-Json
if ($metadata.archived) { throw 'Cannot configure an archived repository.' }
if (-not ($metadata.permissions.push -or $metadata.permissions.admin)) { throw 'Write access to this repository is required.' }
if ($MarkAsTemplate -and -not $metadata.permissions.admin) { throw 'Marking a repository as a template requires admin access.' }

$existing = Invoke-Gh -Arguments @('label', 'list', '--repo', "github.com/$Repository", '--limit', '1000', '--json', 'name,color,description') | ConvertFrom-Json
foreach ($label in $config.labels) {
    $match = @($existing | Where-Object { $_.name -ceq $label.name })
    if ($match.Count -eq 1 -and $match[0].color -ieq $label.color -and $match[0].description -ceq $label.description) {
        Write-Host "Unchanged: $($label.name)"
        continue
    }
    $null = Invoke-Gh -Arguments @('label', 'create', $label.name, '--repo', "github.com/$Repository", '--color', $label.color, '--description', $label.description, '--force')
    Write-Host "Configured: $($label.name)"
}
if ($MarkAsTemplate -and -not $metadata.is_template) {
    $null = Invoke-Gh -Arguments @('repo', 'edit', "github.com/$Repository", '--template')
    Write-Host 'Repository marked as a template.'
}
Write-Host 'Label setup completed. Review the Project setup separately in docs/github-workflow.md.'
