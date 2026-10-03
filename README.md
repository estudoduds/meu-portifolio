# Meu laboratório

## Requisitos

- Node.js 20 ou superior para servir o site localmente.

## Abrir no computador

No VS Code, abra a pasta do projeto e escolha **Terminal > New Terminal**. O terminal integrado normalmente já começa nessa pasta. Confira o caminho:

```powershell
Get-Location
```

Se necessário, entre na pasta do projeto:

```powershell
Set-Location "$env:USERPROFILE\Downloads\meu portifolio"
```

Instale as dependências e inicie o site:

```powershell
npm install
npm start
```

Abra `http://localhost:3000` no navegador. Adicione e organize seus projetos pela página.

## Onde os projetos ficam

Os projetos são guardados no armazenamento local do navegador usado. Limpar os dados do navegador pode apagar essa lista.

## Publicar

O site é estático e pode ser publicado em um serviço de hospedagem de sites. A lista de projetos fica no armazenamento local do navegador e não faz parte dos arquivos publicados.

Use URLs publicadas para os projetos. Caminhos como `C:\Users\...` ou `file://` apontam para arquivos locais e só abrem neste computador.
