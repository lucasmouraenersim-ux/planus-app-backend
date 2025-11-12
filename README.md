# sent-app-backend

Este é o backend para o aplicativo Sent Energia, construído com Next.js e Firebase.

## Como Iniciar

Para começar a desenvolver:

1.  **Instale as dependências:**
    ```bash
    npm install
    ```
2.  **Execute o servidor de desenvolvimento:**
    ```bash
    npm run dev
    ```

Abra [http://localhost:9004](http://localhost:9004) no seu navegador para ver o resultado.

## Troubleshooting

### Build falha com "package.json not found" ou "Invalid root directory"

Se a sua implantação no Firebase App Hosting falhar com um erro indicando que o `package.json` não foi encontrado ou que o diretório raiz é inválido, isso significa que os arquivos do projeto estão dentro de uma subpasta no seu repositório do GitHub, em vez de estarem na raiz, e o Firebase não está conseguindo encontrá-los.

**Como Corrigir:**

1.  **Verifique o nome da pasta no seu repositório do GitHub:** Abra seu repositório no site do GitHub e verifique o nome exato da pasta que contém os arquivos `package.json`, `next.config.ts`, etc. Se os arquivos estiverem na raiz, você usará `/` no próximo passo.
2.  **Ajuste o Diretório Raiz no Firebase:**
    *   Acesse o painel do [Firebase App Hosting](https://console.firebase.google.com/project/energisa-invoice-editor/hosting/backends).
    *   Clique nos três pontos (⋮) ao lado do seu backend (ex: `studio`) e selecione **"Editar back-end"**.
    *   Encontre o campo **"Diretório raiz do app"**.
    *   Altere o valor para o caminho correto. Se seus arquivos estão em uma pasta chamada `meu-app`, digite `/meu-app`. Se eles estão na raiz do repositório, digite `/`.
3.  **Salve as alterações.** Uma nova implantação será iniciada automaticamente, e agora ela deverá encontrar os arquivos do projeto e ser concluída com sucesso.