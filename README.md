# Isekai;Tracker — extensão para Crunchyroll

Código recuperado da extensão de navegador IsekaiTracker 2.0, versão 1.1.1. Ela detecta informações e progresso de reprodução no Crunchyroll e envia eventos ao servidor do Isekai;Tracker.

## Estado da versão

Esta é uma recuperação histórica, ainda sem validação com o Crunchyroll e o IsekaiTracker atuais. O endereço de destino está fixo em `extension-src/isekai-extension-2.0/content.js`: `https://isekai-tracker.discloud.app`. Não há configuração de conta ou pareamento na extensão. A implementação examinada do servidor retransmite eventos recebidos aos clientes conectados; portanto, informações sobre o que é assistido podem ficar visíveis a outras pessoas conectadas. Verifique isolamento e privacidade antes de disponibilizar o rastreamento para vários usuários.

O popup e o README dentro da pasta recuperada mencionam `localhost:3005`, mas o código desta versão envia os eventos diretamente ao endereço HTTPS acima. Esses textos foram preservados como parte da recuperação e estão desatualizados.

## Instalação para teste

1. Em Chrome, Edge ou Brave, abra a página de extensões e ative o modo de desenvolvedor.
2. Escolha **Carregar sem compactação** e selecione `extension-src/isekai-extension-2.0`.
3. Abra um episódio no Crunchyroll e verifique a detecção e o recebimento no Isekai;Tracker.

O funcionamento de ponta a ponta não foi confirmado. A extensão lê metadados e progresso da reprodução nas páginas do Crunchyroll e envia esses dados ao destino configurado no código.

## Projetos

- [Isekai;Tracker](https://github.com/guilhermealceu/isekaitracker-nextgen8)
- Licença do repositório: [MIT](LICENSE).
