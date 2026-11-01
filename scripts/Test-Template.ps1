[CmdletBinding()]
param(
    [string]$Root = (Split-Path -Parent $PSScriptRoot)
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$rootPath = (Resolve-Path -LiteralPath $Root).Path
$prefix = $rootPath.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
$problems = [Collections.Generic.List[string]]::new()
$manifestPath = Join-Path $rootPath 'template.manifest.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding utf8 | ConvertFrom-Json -AsHashtable
if ($manifest.schemaVersion -ne 1) { throw 'Unsupported manifest schema version.' }
$paths = @($manifest.paths)
if ($paths.Count -eq 0) { throw 'The template manifest is empty.' }
$knownPaths = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)

foreach ($relative in $paths) {
    if ($relative -isnot [string] -or [string]::IsNullOrWhiteSpace($relative)) {
        $problems.Add('Manifest paths must be non-empty strings.')
        continue
    }
    if (-not $knownPaths.Add($relative)) { $problems.Add("Duplicate manifest path: $relative") }
    if ([IO.Path]::IsPathRooted($relative) -or $relative -match '(^|[/\\])\.\.([/\\]|$)' -or $relative.Contains('\')) {
        $problems.Add("Unsafe manifest path: $relative")
        continue
    }
    if ($relative -match '(^|/)(\.planning|\.git|\.artifacts|node_modules)(/|$)' -or
        $relative -match '(^|/)\.env($|\.)|\.(pem|key|pfx|p12)$|(^|/)(credentials|secrets)\.json$') {
        $problems.Add("Private or generated file in manifest: $relative")
        continue
    }
    $absolute = [IO.Path]::GetFullPath((Join-Path $rootPath $relative))
    if (-not $absolute.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
        $problems.Add("Manifest path escapes root: $relative")
        continue
    }
    if (-not (Test-Path -LiteralPath $absolute -PathType Leaf)) {
        $problems.Add("Missing template file: $relative")
        continue
    }
    $probe = $absolute
    while ($probe.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
        if ((Get-Item -LiteralPath $probe -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {
            $problems.Add("Symbolic link or reparse point in template path: $relative")
            break
        }
        $probe = Split-Path -Parent $probe
    }
    $content = Get-Content -LiteralPath $absolute -Raw -Encoding utf8
    if ([string]::IsNullOrWhiteSpace($content)) { $problems.Add("Empty file: $relative") }
    if ($relative.EndsWith('.json')) {
        try { $null = $content | ConvertFrom-Json -Depth 40 }
        catch { $problems.Add("Invalid JSON in ${relative}: $($_.Exception.Message)") }
    }
    if ($relative.EndsWith('.ps1')) {
        $parseTokens = $null
        $parseProblems = $null
        $null = [Management.Automation.Language.Parser]::ParseFile($absolute, [ref]$parseTokens, [ref]$parseProblems)
        foreach ($problem in $parseProblems) { $problems.Add("PowerShell syntax in ${relative}: $($problem.Message)") }
    }
    if ($relative.EndsWith('.md')) {
        foreach ($match in [regex]::Matches($content, '\[[^\]]+\]\((?<target>[^)]+)\)')) {
            $target = $match.Groups['target'].Value.Trim('<', '>')
            if ($target -match '^(https?://|mailto:|#)') { continue }
            $target = ($target -split '#', 2)[0]
            if ($target -match '^[A-Za-z][A-Za-z0-9+.-]*:' -or [IO.Path]::IsPathRooted($target)) {
                $problems.Add("Nonportable documentation link in ${relative}: $target")
                continue
            }
            $linkPath = [IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $absolute) $target))
            if (-not $linkPath.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase) -or
                -not (Test-Path -LiteralPath $linkPath -PathType Leaf)) {
                $problems.Add("Broken documentation link in ${relative}: $target")
            }
        }
    }
}

$required = @('README.md', 'AGENTS.md', 'CLAUDE.md', 'LICENSE', 'SECURITY.md', 'CONTRIBUTING.md',
    'template.manifest.json', 'docs/product-vision.md', 'docs/requirements.md', 'docs/architecture.md',
    'docs/roadmap.md', 'docs/security.md', 'docs/permissions.md', 'docs/data-model.md', 'docs/integrations.md',
    'docs/project-setup.md', 'docs/github-workflow.md', 'docs/work-record.md', 'decisions/README.md',
    'decisions/ADR-TEMPLATE.md', 'config/github-labels.json', 'config/github-project.json',
    'scripts/Test-Template.ps1', 'scripts/Export-Template.ps1', 'scripts/Initialize-GitHubLabels.ps1',
    '.github/ISSUE_TEMPLATE/feature.yml', '.github/ISSUE_TEMPLATE/bug.yml',
    '.github/ISSUE_TEMPLATE/technical-debt.yml', '.github/PULL_REQUEST_TEMPLATE.md',
    '.github/workflows/template-quality.yml')
foreach ($path in $required) {
    if (-not $knownPaths.Contains($path)) { $problems.Add("Required file is absent from manifest: $path") }
}

if ($problems.Count -eq 0) {
    $labels = Get-Content -LiteralPath (Join-Path $rootPath 'config/github-labels.json') -Raw | ConvertFrom-Json
    $labelNames = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    if ($labels.schemaVersion -ne 1 -or @($labels.labels).Count -eq 0) { $problems.Add('Invalid label configuration.') }
    foreach ($label in $labels.labels) {
        if (-not $labelNames.Add($label.name)) { $problems.Add("Duplicate label: $($label.name)") }
        if ($label.color -notmatch '^[0-9A-Fa-f]{6}$') { $problems.Add("Invalid label color: $($label.name)") }
        if ($label.name.Length -gt 50 -or $label.description.Length -gt 100) { $problems.Add("Label exceeds GitHub limits: $($label.name)") }
    }
    foreach ($form in @('feature.yml', 'bug.yml', 'technical-debt.yml')) {
        $formPath = Join-Path $rootPath ".github/ISSUE_TEMPLATE/$form"
        $formText = Get-Content -LiteralPath $formPath -Raw
        foreach ($match in [regex]::Matches($formText, 'labels:\s*\["(?<label>[^"]+)"\]')) {
            if (-not $labelNames.Contains($match.Groups['label'].Value)) { $problems.Add("Issue form refers to unconfigured label: $form") }
        }
        foreach ($key in @('name:', 'description:', 'body:')) {
            if ($formText -notmatch "(?m)^$key") { $problems.Add("Issue form missing ${key} $form") }
        }
    }
    $project = Get-Content -LiteralPath (Join-Path $rootPath 'config/github-project.json') -Raw | ConvertFrom-Json
    if ($project.schemaVersion -ne 1 -or $project.visibility -ne 'PRIVATE') { $problems.Add('Invalid Project configuration.') }
    if (@($project.status | Select-Object -Unique).Count -ne @($project.status).Count) { $problems.Add('Duplicate Project statuses.') }
    foreach ($field in $project.fields) {
        if ($field.type -ne 'SINGLE_SELECT' -or @($field.options).Count -eq 0) { $problems.Add("Invalid Project field: $($field.name)") }
    }
}

if ($problems.Count -gt 0) {
    foreach ($problem in $problems) { Write-Host "ERROR: $problem" }
    throw "Template validation failed with $($problems.Count) problem(s)."
}
Write-Host "Template validation passed: $($paths.Count) manifest files, local Markdown links, JSON configuration, PowerShell syntax, and issue-form labels."
Write-Host 'Checks are offline; GitHub YAML schema acceptance and hosted CI are verified after publication.'
