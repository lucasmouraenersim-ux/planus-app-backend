# Como Configurar os Secrets do Firebase App Hosting

## Passo a Passo

### 1. Abra o PowerShell no diretório do projeto

Navegue até: `C:\Users\Usuário\Downloads\download (6)\studio`

### 2. Execute os comandos abaixo (substitua `SEU_TOKEN_AQUI` pelo token do seu arquivo .env)

```powershell
# Configurar ASAAS_TOKEN
# IMPORTANTE: Substitua SEU_TOKEN_AQUI pelo valor real do seu arquivo .env
"SEU_TOKEN_AQUI" | firebase apphosting:secrets:set ASAAS_TOKEN --project energisa-invoice-editor --data-file=- --force

# Configurar ASAAS_ENV
"sandbox" | firebase apphosting:secrets:set ASAAS_ENV --project energisa-invoice-editor --data-file=- --force
```

### 3. Alternativa: Usar arquivo temporário

Se o método acima não funcionar, crie arquivos temporários:

```powershell
# Criar arquivo com o token
"SEU_TOKEN_AQUI" | Out-File -FilePath temp_token.txt -Encoding utf8 -NoNewline

# Configurar secret usando o arquivo
firebase apphosting:secrets:set ASAAS_TOKEN --project energisa-invoice-editor --data-file=temp_token.txt --force

# Criar arquivo com o ambiente
"sandbox" | Out-File -FilePath temp_env.txt -Encoding utf8 -NoNewline

# Configurar secret usando o arquivo
firebase apphosting:secrets:set ASAAS_ENV --project energisa-invoice-editor --data-file=temp_env.txt --force

# Limpar arquivos temporários
Remove-Item temp_token.txt, temp_env.txt
```

### 4. Verificar se os secrets foram criados

```powershell
firebase apphosting:secrets:describe ASAAS_TOKEN --project energisa-invoice-editor
firebase apphosting:secrets:describe ASAAS_ENV --project energisa-invoice-editor
```

### 5. Fazer deploy do backend (opcional)

Após configurar os secrets, você pode fazer deploy:

```powershell
firebase deploy --only apphosting:backends:studio --project energisa-invoice-editor
```

## Nota Importante

- Os secrets configurados no Firebase App Hosting estarão disponíveis como variáveis de ambiente (`process.env.ASAAS_TOKEN` e `process.env.ASAAS_ENV`)
- Para desenvolvimento local, você ainda precisa do arquivo `.env.local` com as mesmas variáveis

