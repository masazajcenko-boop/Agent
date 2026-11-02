[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$Repo = 'masazajcenko-boop/Agent'
$Branch = 'feature/agent-a-rag-integration'
$BaseUrl = "https://raw.githubusercontent.com/$Repo/$Branch/A-RAG"
$TargetDir = $PSScriptRoot
$AllowedFiles = @(
    'main.py',
    'requirements.txt',
    'install-rag.bat',
    'start-rag.bat',
    'test-rag.bat',
    'README.md',
    'config.bat.example'
)

$TempRoot = Join-Path $env:TEMP ("a-rag-update-" + [guid]::NewGuid().ToString('N'))
$StageDir = Join-Path $TempRoot 'stage'
$BackupDir = Join-Path $TempRoot 'backup'
$Copied = New-Object System.Collections.Generic.List[string]

function Write-Info([string]$Message) {
    Write-Host "[A-RAG] $Message" -ForegroundColor Cyan
}

try {
    Write-Info "Target: $TargetDir"
    Write-Info "Source branch: $Branch"
    Write-Info 'Protected: data/, .venv/, config.bat and all other local files.'

    if (-not (Test-Path (Join-Path $TargetDir 'main.py'))) {
        throw 'main.py was not found. Run this updater from the A-RAG folder.'
    }

    New-Item -ItemType Directory -Path $StageDir -Force | Out-Null
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null

    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

    foreach ($File in $AllowedFiles) {
        $Url = "$BaseUrl/$File"
        $Destination = Join-Path $StageDir $File
        Write-Info "Downloading $File ..."
        Invoke-WebRequest -Uri $Url -OutFile $Destination -UseBasicParsing -TimeoutSec 30

        if (-not (Test-Path $Destination)) {
            throw "Download failed: $File"
        }

        $Item = Get-Item $Destination
        if ($Item.Length -lt 10) {
            throw "Downloaded file is unexpectedly small: $File"
        }

        $Prefix = Get-Content -LiteralPath $Destination -TotalCount 1 -ErrorAction SilentlyContinue
        if ($Prefix -match '^\s*<(html|!doctype)') {
            throw "GitHub returned a web page instead of a source file: $File"
        }
    }

    Write-Info 'All files downloaded. Creating temporary backups...'
    foreach ($File in $AllowedFiles) {
        $Current = Join-Path $TargetDir $File
        if (Test-Path $Current) {
            Copy-Item -LiteralPath $Current -Destination (Join-Path $BackupDir $File) -Force
        }
    }

    try {
        foreach ($File in $AllowedFiles) {
            Copy-Item -LiteralPath (Join-Path $StageDir $File) -Destination (Join-Path $TargetDir $File) -Force
            $Copied.Add($File)
        }
    }
    catch {
        Write-Host '[A-RAG] Copy failed. Restoring previous program files...' -ForegroundColor Yellow
        foreach ($File in $Copied) {
            $Current = Join-Path $TargetDir $File
            $Backup = Join-Path $BackupDir $File
            if (Test-Path $Backup) {
                Copy-Item -LiteralPath $Backup -Destination $Current -Force
            }
            elseif (Test-Path $Current) {
                Remove-Item -LiteralPath $Current -Force
            }
        }
        throw
    }

    Write-Host ''
    Write-Host 'A-RAG program files updated successfully.' -ForegroundColor Green
    Write-Host 'Your database, config.bat and .venv were not changed.' -ForegroundColor Green
    Write-Host 'If requirements.txt changed, run install-rag.bat when convenient.'
    Write-Host 'Then start start-rag.bat and verify with test-rag.bat.'
}
catch {
    Write-Host ''
    Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'No database, local config or virtual environment files are modified.'
    exit 1
}
finally {
    if (Test-Path $TempRoot) {
        Remove-Item -LiteralPath $TempRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
