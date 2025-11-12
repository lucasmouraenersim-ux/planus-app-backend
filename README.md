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

### Build falha com "package.json not found"

Se a sua implantação no Firebase App Hosting falhar com o erro `package.json not found`, isso significa que os arquivos do projeto estão dentro de uma subpasta no seu repositório do GitHub, em vez de estarem na raiz.

**Como Corrigir:**

1.  **Verifique seu repositório no GitHub:** O seu código está dentro do repositório/pasta chamado `planus-app-backend`.
2.  **Ajuste o Diretório Raiz no Firebase:**
    *   Acesse o painel do [Firebase App Hosting](https://console.firebase.google.com/project/energisa-invoice-editor/hosting/backends).
    *   Clique nos três pontos (⋮) ao lado do seu backend (ex: `studio` ou o nome do backend que você criou) e selecione **"Editar back-end"**.
    *   Encontre o campo **"Diretório raiz do app"**.
    *   Altere o valor de `/` para `/planus-app-backend`.
3.  **Salve as alterações.** Uma nova implantação será iniciada automaticamente, e agora ela deverá encontrar os arquivos do projeto e ser concluída com sucesso.