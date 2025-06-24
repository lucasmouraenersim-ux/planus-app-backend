# planus-app-backend

Este é o backend para o aplicativo Planus Energia, construído com Next.js e Firebase.

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

Abra [http://localhost:9002](http://localhost:9002) no seu navegador para ver o resultado.

## Troubleshooting

### Build falha com "package.json not found"

Se a sua implantação no Firebase App Hosting falhar com um erro como `package.json not found` ou `No buildpack groups passed detection`, isso geralmente significa que os arquivos do projeto estão dentro de uma subpasta no seu repositório do GitHub, em vez de na raiz.

**Como Corrigir:**

1.  **Verifique seu repositório no GitHub:** Vá para a página do seu repositório e veja se todos os arquivos (`package.json`, `src`, `next.config.ts`, etc.) estão na página inicial ou se estão dentro de uma pasta (por exemplo, uma pasta chamada `planus-app-backend`).
2.  **Ajuste o Diretório Raiz no Firebase:**
    *   Acesse o painel do [Firebase App Hosting](https://console.firebase.google.com/project/energisa-invoice-editor/hosting/backends).
    *   Clique nos três pontos (⋮) ao lado do seu backend `planus-app-backend` e selecione **"Editar back-end"**.
    *   Encontre o campo **"Diretório raiz do app"**.
    *   Altere o valor de `/` para o nome da pasta onde seu código está. Por exemplo, se a pasta for `planus-app-backend`, o valor deve ser `/planus-app-backend`.
3.  **Salve as alterações.** O Firebase iniciará uma nova implantação, que agora deverá encontrar os arquivos e ser concluída com sucesso.
# planus-app-backend

Backend configurado para implantação estável.
