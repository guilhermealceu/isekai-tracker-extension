# Isekai;Tracker — Extensão MV3 (Crunchyroll)

Esta extensão substitui o userscript do Tampermonkey.
Ela injeta um content script no Crunchyroll (topo e iframe do player) e envia
os eventos para `http://localhost:3005`.

## Instalar (Chrome/Edge/Brave)
1. Acesse `chrome://extensions/`.
2. Ative **Modo do desenvolvedor** (canto superior direito).
3. Clique **Carregar sem compactação** e selecione esta pasta.
4. Abra um episódio no Crunchyroll. Com o servidor do Isekai;Tracker rodando, já registra.

## Permissões
- `https://www.crunchyroll.com/*` e `https://static.crunchyroll.com/*` para injetar no site e no iframe do player.
- `http://localhost:3005/*` para postar os scrobbles/heartbeats.

## Observações
- O servidor (`server.js`) já permite CORS para os dois domínios do Crunchyroll.
- `sendBeacon` é usado como caminho rápido em saídas; senão cai em `fetch` normal.
