param([switch]$RebuildModel, [switch]$SkipFrontend)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
    if (-not (Test-Path -LiteralPath '.venv\Scripts\python.exe')) {
        & py -3.14 -m venv .venv
        if ($LASTEXITCODE -ne 0) { throw 'Install Python 3.14 first.' }
    }
    & .\.venv\Scripts\python.exe -m pip install -r requirements.txt
    if ($LASTEXITCODE -ne 0) { throw 'Python dependency installation failed.' }
    if ($RebuildModel -or -not (Test-Path -LiteralPath 'ml\models\step_ranker.joblib')) {
        & .\.venv\Scripts\python.exe -m ml.generate_dataset --scenarios 100 --seed 42
        if ($LASTEXITCODE -ne 0) { throw 'Dataset generation failed.' }
        & .\.venv\Scripts\python.exe -m ml.train_model
        if ($LASTEXITCODE -ne 0) { throw 'Model training failed.' }
    }
    if (-not $SkipFrontend) {
        Push-Location frontend
        try {
            & npm.cmd ci
            if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }
        } finally { Pop-Location }
    }
    Write-Host 'Setup complete. Run .\.venv\Scripts\python.exe scripts\check.py to verify.'
} finally { Pop-Location }
