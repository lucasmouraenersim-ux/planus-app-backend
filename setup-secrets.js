const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectId = 'energisa-invoice-editor';

console.log('=== Configuração de Secrets do Firebase App Hosting ===\n');

// Ler arquivo .env
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.error('❌ Arquivo .env não encontrado!');
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

// Configurar secret ASAAS_TOKEN
console.log('Configurando secret ASAAS_TOKEN...');
try {
  execSync(
    `echo ${JSON.stringify(asaasToken)} | firebase apphosting:secrets:set ASAAS_TOKEN --project ${projectId} --data-file=- --force`,
    { stdio: 'inherit', shell: true }
  );
  console.log('✓ Secret ASAAS_TOKEN configurado com sucesso!\n');
} catch (error) {
  console.error('❌ Erro ao configurar ASAAS_TOKEN');
  process.exit(1);
}

// Configurar secret ASAAS_ENV
console.log('Configurando secret ASAAS_ENV...');
try {
  execSync(
    `echo ${JSON.stringify(asaasEnv)} | firebase apphosting:secrets:set ASAAS_ENV --project ${projectId} --data-file=- --force`,
    { stdio: 'inherit', shell: true }
  );
  console.log('✓ Secret ASAAS_ENV configurado com sucesso!\n');
} catch (error) {
  console.error('❌ Erro ao configurar ASAAS_ENV');
  process.exit(1);
}

console.log('=== Concluído ===');
console.log('Lembre-se de fazer o deploy do backend para aplicar as mudanças!');

