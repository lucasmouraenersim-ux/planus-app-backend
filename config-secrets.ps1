# Script para configurar secrets do Firebase App Hosting
# Execute este script no PowerShell estando no diretório do projeto

$projectId = "energisa-invoice-editor"

Write-Host "=== Configuração de Secrets do Firebase App Hosting ===" -ForegroundColor Cyan
Write-Host ""

# Ler arquivo .env
if (-not (Test-Path ".env")) {
    Write-Host "❌ Arquivo .env não encontrado no diretório atual!" -ForegroundColor Red
    Write-Host "Diretório atual: $(Get-Location)" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ Arquivo .env encontrado" -ForegroundColor Green

# Ler conteúdo do .env
$envContent = Get-Content .env -Raw

# Extrair ASAAS_TOKEN
$asaasToken = ""
if ($envContent -match "ASAAS_TOKEN\s*=\s*(.+?)(?:\r?\n|$)") {
    $asaasToken = $matches[1].Trim()
    # Remove aspas se houver
    $asaasToken = $asaasToken -replace '^["'']|["'']$', ''
}

# Extrair ASAAS_ENV
$asaasEnv = "sandbox"
if ($envContent -match "ASAAS_ENV\s*=\s*(.+?)(?:\r?\n|$)") {
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

# Criar arquivo temporário com o token
$tempTokenFile = "temp_asaas_token.txt"
$asaasToken | Out-File -FilePath $tempTokenFile -Encoding utf8 -NoNewline

# Configurar secret ASAAS_TOKEN
Write-Host "Configurando secret ASAAS_TOKEN..." -ForegroundColor Yellow
try {
    firebase apphosting:secrets:set ASAAS_TOKEN --project $projectId --data-file $tempTokenFile --force
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Secret ASAAS_TOKEN configurado com sucesso!" -ForegroundColor Green
    } else {
        throw "Erro ao configurar secret"
    }
} catch {
    Write-Host "❌ Erro ao configurar ASAAS_TOKEN: $_" -ForegroundColor Red
    Remove-Item $tempTokenFile -ErrorAction SilentlyContinue
    exit 1
}

Write-Host ""

# Criar arquivo temporário com o ambiente
$tempEnvFile = "temp_asaas_env.txt"
$asaasEnv | Out-File -FilePath $tempEnvFile -Encoding utf8 -NoNewline

# Configurar secret ASAAS_ENV
Write-Host "Configurando secret ASAAS_ENV..." -ForegroundColor Yellow
try {
    firebase apphosting:secrets:set ASAAS_ENV --project $projectId --data-file $tempEnvFile --force
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Secret ASAAS_ENV configurado com sucesso!" -ForegroundColor Green
    } else {
        throw "Erro ao configurar secret"
    }
} catch {
    Write-Host "❌ Erro ao configurar ASAAS_ENV: $_" -ForegroundColor Red
    Remove-Item $tempTokenFile, $tempEnvFile -ErrorAction SilentlyContinue
    exit 1
}

# Limpar arquivos temporários
Remove-Item $tempTokenFile, $tempEnvFile -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "=== Concluído ===" -ForegroundColor Cyan
Write-Host "Lembre-se de fazer o deploy do backend para aplicar as mudanças!" -ForegroundColor Yellow
Write-Host "Comando: firebase deploy --only apphosting:backends:studio --project $projectId" -ForegroundColor Gray
