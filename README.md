# Meu laboratório

## Requisitos

- Uma conta e um projeto no [Supabase](https://supabase.com/).
- Node.js 20 ou superior para servir o site localmente.

## Criar a tabela no Supabase

1. Entre no painel do Supabase e crie um projeto. Escolha um nome, uma senha forte para o banco e a região mais próxima. A senha do banco é administrada pelo Supabase e não será usada neste site.
2. Quando o projeto estiver pronto, abra **SQL Editor** no menu lateral e clique em **New query**.
3. Volte ao VS Code e abra `schema.sql` na lista de arquivos à esquerda. Se não encontrar o arquivo, use **File > Open File...** e navegue até a pasta `meu portifolio`. Com `schema.sql` aberto, clique dentro do código, pressione **Ctrl+A** para selecionar todo o script e **Ctrl+C** para copiá-lo. Volte à aba do navegador com o Supabase, clique na área de texto da consulta **New query** e pressione **Ctrl+V**. Confira se o script cria as tabelas `public.projects` e `public.login_handles` e inclui a política `Users manage their own projects`. Não cole o conteúdo em **Table Editor**; ele deve ser executado no **SQL Editor**.
4. Clique em **Run**. O script cria a tabela `public.projects`, habilita Row Level Security (RLS), concede operações à função autenticada e cria a política que restringe cada pessoa aos próprios projetos.
5. No painel **Table Editor**, confirme que existe a tabela `projects`. Não crie uma tabela de usuários: o login fica em **Authentication** do Supabase.

O script pode ser executado novamente. Ele não apaga projetos; recria a política de acesso para manter as regras do projeto atualizadas.

## Configurar as chaves

1. No painel do Supabase, confira se está dentro do projeto que criou e clique na engrenagem **Project Settings** no menu lateral.
2. Encontre a **Project URL**. Conforme a versão do painel, ela aparece em **API** ou **Data API**. Copie o endereço completo, que costuma ter o formato `https://identificador-do-projeto.supabase.co`.
3. Encontre as chaves da API em **API Keys** ou na seção **API**. Copie a chave pública **Publishable key**, que normalmente começa com `sb_publishable_`. Se o painel mostrar as chaves legadas, use `anon`.
4. Não copie a senha do banco, a chave `secret` (geralmente começa com `sb_secret_`) nem `service_role`. Essas chaves privadas não devem ser colocadas no navegador.
5. No VS Code, clique em `config.js` na lista de arquivos. Apague somente os valores vazios entre as aspas e cole sua URL e chave pública, mantendo os nomes `url` e `anonKey`, as aspas e as vírgulas:

```js
window.APP_CONFIG = {
  url: 'https://identificador-do-projeto.supabase.co',
  anonKey: 'sb_publishable_sua-chave-publica',
};
```

6. Substitua os exemplos pelas credenciais do seu próprio projeto e salve com **Ctrl+S**. Não acrescente espaços ou quebras de linha dentro dos valores. Depois inicie ou recarregue o site para ele ler a configuração.

Se a URL ou a chave estiver errada, o app não conseguirá carregar os projetos e o status de sincronização indicará uma falha. Volte às configurações do mesmo projeto e copie os valores novamente. A chave `Publishable`/`anon` é pública e pode estar no frontend porque a tabela está protegida por RLS; nunca use `service_role` ou uma chave `secret` no site.

O arquivo `config.js` é a configuração usada pelo frontend. Um `.env` que tenha sobrado da configuração MySQL anterior não é lido pelo app; mantenha-o ignorado pelo Git e não publique senhas antigas do banco.

## Configurar login com nome de usuário

O cadastro pede nome de usuário, e-mail e senha. Depois, a pessoa pode entrar com nome de usuário ou continuar usando o e-mail. O e-mail permanece privado e é usado para confirmação e recuperação. Ao atualizar o schema, contas antigas recebem como usuário o prefixo do e-mail (normalizado); se houver duplicidade, recebem um sufixo numérico. Elas também continuam aceitando o e-mail.

1. Execute novamente o arquivo atualizado `schema.sql` no **SQL Editor** do Supabase para criar a tabela privada de nomes de usuário e associá-los às contas existentes.
2. No painel Supabase, adicione o segredo `SUPABASE_SECRET_KEY` em **Edge Functions > Secrets**. Use uma chave `secret` ou `service_role`; nunca a coloque em `config.js` ou em qualquer arquivo publicado.
3. Instale e autentique o Supabase CLI, vincule o projeto e publique a função:

```powershell
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase functions deploy username-login --no-verify-jwt
```

O arquivo `supabase/config.toml` mantém a função acessível para login sem sessão prévia. A função valida o usuário no servidor e nunca devolve o e-mail ao navegador. O segredo de servidor fica somente no Supabase.

Em **Authentication > URL Configuration**, permita `http://localhost:3000/**` para testes locais e `https://estudoduds.github.io/meu-portifolio/**` para o site publicado. A confirmação de e-mail deve estar habilitada; confirme a mensagem recebida antes do primeiro login.

## Abrir no computador

### Abrir o PowerShell na pasta do projeto

No VS Code, abra a pasta pelo menu **File > Open Folder...** e selecione `meu portifolio`. Depois abra **Terminal > New Terminal**. O terminal integrado aparece na parte inferior e normalmente já começa nessa pasta.

Confira o caminho atual:

```powershell
Get-Location
```

Se ele não terminar em `Downloads\meu portifolio`, execute:

```powershell
Set-Location "$env:USERPROFILE\Downloads\meu portifolio"
```

Instale o servidor estático e inicie o site:

```powershell
npm install
npm start
```

Abra `http://localhost:3000` no navegador. Clique em **Entrar para sincronizar** e crie uma conta. Use a mesma conta nos outros dispositivos. Se o navegador tiver projetos salvos localmente de uma versão anterior, o app oferece importá-los quando a conta ainda estiver vazia.

## Publicar

O frontend é estático e pode ser publicado em um serviço de hospedagem de sites. O Supabase continua hospedando o banco e a autenticação; não é necessário publicar um servidor MySQL ou a API Node anterior. Configure a URL HTTPS publicada em **Authentication > URL Configuration** e permita também o endereço de redirecionamento.

Use URLs publicadas para os projetos. Caminhos como `C:\Users\...` ou `file://` apontam para arquivos de um único computador e não estarão disponíveis em outros dispositivos.

Os dados que estejam apenas no antigo banco MySQL não são migrados automaticamente. A importação oferecida pelo app cobre os projetos guardados no `localStorage` do navegador.