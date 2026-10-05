# Meu laboratório

Portfólio estático hospedado no Firebase Hosting. Os projetos são sincronizados pelo Cloud Firestore e ficam privados para a conta Google conectada.

## Configurar o Firebase

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com/) e registre um app Web.
2. Ative Google em **Authentication > Sign-in method**.
3. Crie o banco em **Firestore Database**.
4. Copie `apiKey`, `authDomain`, `projectId` e `appId` do app Web para `firebase-config.js`, substituindo os valores `COLE_...`.
5. No terminal, autentique o Firebase CLI e selecione o projeto:

```powershell
npx firebase-tools login
npx firebase-tools use --add
```

## Publicar

Na raiz do projeto, rode:

```powershell
npm run deploy
```

O comando publica o site no Firebase Hosting e aplica `firestore.rules`. O endereço será exibido pelo Firebase CLI. No Firebase Console, confirme que o domínio publicado está autorizado em **Authentication > Settings > Authorized domains**.

## GitHub Pages

O workflow em `.github/workflows/pages.yml` publica os arquivos estáticos ao enviar alterações para `main` ou `master`. No repositório GitHub, configure **Settings > Pages > Build and deployment > Source** como **GitHub Actions**.

No Firebase Authentication, mantenha `estudoduds.github.io` em **Authorized domains**. O login usa popup no GitHub Pages e redirect no Firebase Hosting.

URL esperada: `https://estudoduds.github.io/meu-portifolio/`.

## Executar localmente

Requer Node.js 20 ou superior:

```powershell
npm install
npm start
```

Abra `http://localhost:3000`. O login e o Firestore também exigem a configuração acima; adicione `localhost` aos domínios autorizados do Firebase Authentication.

Use URLs publicadas para os projetos. Caminhos como `C:\Users\...` ou `file://` apontam para arquivos locais e só abrem neste computador.
