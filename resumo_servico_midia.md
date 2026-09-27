# Resumo - Serviço 2 (Motor de Mídia)

Este arquivo detalha as implementações recentes no pipeline de Geração de Vídeo Automatizado focado em curtas virais (YouTube Shorts, TikTok).

## ✅ O que foi feito

1. **TTS (Text-to-Speech) de Alta Qualidade:**
   - Adicionada integração com a API da OpenAI (`tts-1`, voz profunda `onyx`) em `servico2-midia/src/audio.js`.
   - Implementado fallback contínuo (bip de 440Hz com mock local) para casos em que a variável de desenvolvimento `OPENAI_API_KEY` não for informada.

2. **Renderização Vertical Avançada (FFmpeg):**
   - Adequado o aspecto de imagem para 9:16 (resolução Vertical `720x1280`), essencial para plataformas Short-form.
   - Aplicação do filtro **Ken Burns** contínuo (`zoompan=z='min(zoom+0.0015,1.2)'`), impedindo que o vídeo fique com recortes estáticos.

3. **Legendas Dinâmicas Injetadas (SRT + filter_complex):**
   - Criação de gerador SRT sob demanda (`gerarLegendasSrt`) baseando-se em chunks de ~4 palavras matematicamente fracionadas ao longo da timeline de áudio.
   - Corrigido travamento severo do motor FFmpeg injetando o filtro de legenda `subtitles` exatamente no encadeamento do `filter_complex`, respeitando regras estritas de pipes de vídeo (`[outv]subtitles=...[finalv]`).

4. **Gerenciador de Filas e Garbage Collection Extremo:**
   - Corrigido o `worker.js` e o BullMQ no Redis: o app agora limpa travas "órfãs" decorrentes de kills passados.
   - Implementado um GC (`fs.rmSync`) rodando obrigatoriamente num bloco `finally` dentro do worker, estripando todo o lixo do diretório `/tmp/video_{id}` assim que a renderização termina ou sofre exceção. Evita vazamento no disco de SSD do servidor.

---

## 🛠️ O que precisamos melhorar (Tech Debt)

1. **Vozes Virais Avançadas:** Migrar ou adicionar provedor da **ElevenLabs** (vozes mais orgânicas e emotivas retêm mais engajamento do que a Onyx da OpenAI).
2. **Fontes Personalizadas nas Legendas:** Substituir a fonte Arial padrão por `.ttf` externas impactantes (ex: *The Bold Font*, *Bangers* ou *Montserrat Black* uppercase), emulando as edições de "Alex Hormozi".
3. **Transições de Vídeo (Crossfade):** Acrescentar uma transição suave entre a troca de imagens no `filter_complex` (`xfade`) ao invés do corte seco nativo (`concat=n`).
4. **Gerador Real de Imagens:** Substituir o local `baixarImagensMock` pela injeção da API da **Midjourney** (via integrações de Discord) ou **DALL-E 3**.
5. **Cálculo Fonético do SRT:** A legenda baseada em divisão matemática de palavras não atende pausas longas e vírgulas. Substituir por retorno de timestamp fidedignos em APIs TTS (como OpenAI Whisper-level timestamps) se necessário sincronismo a nível de sílaba.

---

## 🚀 Próximos Passos no Pipeline

1. **Apresentação Visual / Interface de Aprovação:**
   - Como os vídeos gerados caem agora no status `AGUARDANDO_APROVACAO_VIDEO`, precisamos montar uma tela web (Next.js simples) ou um bot de Admin no Telegram para que o Editor Humano assista o vídeo em `output/` e clique em [Aprovar] ou [Rejeitar].
2. **Desenvolver o Serviço 3 (Integração e Publicação):**
   - Iniciar código do worker 3 para monitorar os vídeos `AGENDADOS`.
   - Adicionar OAuth2 do YouTube Data API v3 para subir e publicar como Short.
   - Adicionar TikTok API for Business / Instagram Graph API para espelhamento simultâneo do arquivo.