const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Usar caminho absoluto do workspace
const workspacePath = process.cwd();
const envPath = path.join(workspacePath, '.env');
const projectId = 'energisa-invoice-editor';

console.log('=== Configuração de Secrets do Firebase App Hosting ===');
console.log(`Diretório: ${workspacePath}\n`);

// Ler arquivo .env
if (!fs.existsSync(envPath)) {
  console.error(`❌ Arquivo .env não encontrado em: ${envPath}`);
  console.error('Por favor, certifique-se de que o arquivo .env existe na raiz do projeto.');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
let asaasToken = '';
let asaasEnv = 'sandbox';

// Extrair ASAAS_TOKEN
const tokenMatch = envContent.match(/ASAAS_TOKEN\s*=\s*(.+)/);
if (tokenMatch) {
  asaasToken = tokenMatch[1].trim().replace(/^["']|["']$/g, '');
}

// Extrair ASAAS_ENV
const envMatch = envContent.match(/ASAAS_ENV\s*=\s*(.+)/);
if (envMatch) {
  asaasEnv = envMatch[1].trim().replace(/^["']|["']$/g, '');
}

if (!asaasToken) {
  console.error('❌ ASAAS_TOKEN não encontrado no arquivo .env!');
  console.error('Por favor, adicione ASAAS_TOKEN=seu_token no arquivo .env');
  process.exit(1);
}

console.log(`✓ Token encontrado (tamanho: ${asaasToken.length} caracteres)`);
console.log(`✓ Ambiente: ${asaasEnv}\n`);

// Configurar secret ASAAS_TOKEN usando arquivo temporário
const tempTokenFile = path.join(workspacePath, 'temp_token.txt');
fs.writeFileSync(tempTokenFile, asaasToken, 'utf-8');

console.log('Configurando secret ASAAS_TOKEN...');
try {
  execSync(
    `firebase apphosting:secrets:set ASAAS_TOKEN --project ${projectId} --data-file "${tempTokenFile}" --force`,
    { stdio: 'inherit', cwd: workspacePath }
  );
  console.log('✓ Secret ASAAS_TOKEN configurado com sucesso!\n');
} catch (error) {
  console.error('❌ Erro ao configurar ASAAS_TOKEN:', error.message);
  fs.unlinkSync(tempTokenFile);
  process.exit(1);
}

// Configurar secret ASAAS_ENV
const tempEnvFile = path.join(workspacePath, 'temp_env.txt');
fs.writeFileSync(tempEnvFile, asaasEnv, 'utf-8');

console.log('Configurando secret ASAAS_ENV...');
try {
  execSync(
    `firebase apphosting:secrets:set ASAAS_ENV --project ${projectId} --data-file "${tempEnvFile}" --force`,
    { stdio: 'inherit', cwd: workspacePath }
  );
  console.log('✓ Secret ASAAS_ENV configurado com sucesso!\n');
} catch (error) {
  console.error('❌ Erro ao configurar ASAAS_ENV:', error.message);
  fs.unlinkSync(tempTokenFile);
  fs.unlinkSync(tempEnvFile);
  process.exit(1);
}

// Limpar arquivos temporários
fs.unlinkSync(tempTokenFile);
fs.unlinkSync(tempEnvFile);

console.log('=== Concluído ===');
console.log('Lembre-se de fazer o deploy do backend para aplicar as mudanças!');

