# Script para configurar secrets do Firebase App Hosting
# Execute: .\setup-firebase-secrets.ps1

$projectId = "energisa-invoice-editor"

Write-Host "=== Configuração de Secrets do Firebase App Hosting ===" -ForegroundColor Cyan
Write-Host ""

# Tentar encontrar o arquivo .env em diferentes locais
$envFile = $null
$possiblePaths = @(
    ".env",
    "$PSScriptRoot\.env",
    "$PWD\.env",
    (Join-Path (Get-Location) ".env")
)

foreach ($path in $possiblePaths) {
    if (Test-Path $path) {
        $envFile = $path
        Write-Host "✓ Arquivo .env encontrado em: $path" -ForegroundColor Green
        break
    }
}

if (-not $envFile) {
    Write-Host "❌ Arquivo .env não encontrado!" -ForegroundColor Red
    Write-Host "Procurou em:" -ForegroundColor Yellow
    $possiblePaths | ForEach-Object { Write-Host "  - $_" }
    exit 1
}

# Ler variáveis do .env
$envContent = Get-Content $envFile -Raw
$asaasToken = ""
$asaasEnv = "sandbox"

# Extrair ASAAS_TOKEN
if ($envContent -match "ASAAS_TOKEN\s*=\s*(.+)") {
    $asaasToken = $matches[1].Trim()
    # Remove aspas se houver
    $asaasToken = $asaasToken -replace '^["'']|["'']$', ''
}

# Extrair ASAAS_ENV
if ($envContent -match "ASAAS_ENV\s*=\s*(.+)") {
    $asaasEnv = $matches[1].Trim()
    $asaasEnv = $asaasEnv -replace '^["'']|["'']$', ''
}

if ([string]::IsNullOrWhiteSpace($asaasToken)) {
    Write-Host "❌ ASAAS_TOKEN não encontrado no arquivo .env!" -ForegroundColor Red
    Write-Host "Por favor, adicione ASAAS_TOKEN=seu_token no arquivo .env" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ Token encontrado (tamanho: $($asaasToken.Length) caracteres)" -ForegroundColor Green
Write-Host "✓ Ambiente: $asaasEnv" -ForegroundColor Green
Write-Host ""

# Configurar secret ASAAS_TOKEN
Write-Host "Configurando secret ASAAS_TOKEN..." -ForegroundColor Yellow
$asaasToken | firebase apphosting:secrets:set ASAAS_TOKEN --project $projectId --data-file=- --force
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Secret ASAAS_TOKEN configurado com sucesso!" -ForegroundColor Green
} else {
    Write-Host "❌ Erro ao configurar ASAAS_TOKEN" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Configurar secret ASAAS_ENV
Write-Host "Configurando secret ASAAS_ENV..." -ForegroundColor Yellow
$asaasEnv | firebase apphosting:secrets:set ASAAS_ENV --project $projectId --data-file=- --force
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Secret ASAAS_ENV configurado com sucesso!" -ForegroundColor Green
} else {
    Write-Host "❌ Erro ao configurar ASAAS_ENV" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== Concluído ===" -ForegroundColor Cyan
Write-Host "Lembre-se de fazer o deploy do backend para aplicar as mudanças!" -ForegroundColor Yellow

