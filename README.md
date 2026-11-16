# Rune Projects Hub — extensão do IsekaiTracker

Extensão de navegador com painel lateral para acessar os projetos Rune e acompanhar episódios assistidos no Crunchyroll. Esta cópia recuperada é a versão **1.1.2**.

## Instalação para teste

1. Baixe ou clone este repositório.
2. Abra a página de extensões do Chrome ou Edge e ative o **Modo do desenvolvedor**.
3. Selecione **Carregar sem compactação** e escolha a pasta que contém `manifest.json`.
4. Clique no ícone da extensão para abrir o painel lateral. Abra um episódio no Crunchyroll para testar o rastreamento.

Por padrão, a extensão envia eventos de reprodução para `https://isekaitracker.runeprojects.com.br`. O painel também oferece configuração para servidor local ou personalizado. O funcionamento com os serviços atuais ainda precisa de validação de ponta a ponta.

## Privacidade e limitações

A extensão lê informações do episódio e da reprodução no Crunchyroll, envia eventos ao servidor configurado e mantém informações recentes no armazenamento do navegador. Veja [privacidade](privacy_policy.html). Antes de uso compartilhado, é necessário verificar como o servidor identifica usuários e restringe o acesso aos eventos; a implementação local examinada anteriormente retransmitia eventos sem isolamento por conta.

[Site do IsekaiTracker](https://isekaitracker.runeprojects.com.br/) · [Projeto IsekaiTracker](https://github.com/guilhermealceu/isekaitracker-nextgen8) · [Licença MIT](LICENSE)
