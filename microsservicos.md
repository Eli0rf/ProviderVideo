# Arquitetura de Microsserviços e Infraestrutura
**Objetivo:** Instruções técnicas de implementação e escalabilidade.

## 1. Padrão de Fila e Processamento (Workers)
*   **Proibido uso de Cron Jobs simples para tarefas pesadas.** O sistema deve utilizar Filas Assíncronas (`Redis` + `BullMQ` no Node.js ou `Celery` em Python).
*   Cada microsserviço abaixo é um *Worker* independente que consome da fila ou ouve mudanças no banco.

## 2. Descrição dos Microsserviços
1.  **Serviço 1 - Ideação (IA):**
    *   *Ferramentas:* Integração API Gemini / OmniRoute.
    *   *Input:* `status='BUSCANDO_TEMA'`.
    *   *Output:* JSON forçado (Título, Roteiro, Prompts, Humor) -> Atualiza Banco.
2.  **Serviço 2 - Motor de Mídia (FFmpeg):**
    *   *Ferramentas:* ElevenLabs/OpenAI (TTS), DALL-E/Midjourney, `fluent-ffmpeg`.
    *   *Tarefa:* Baixar imagens, sintetizar voz, mesclar no FFmpeg, adicionar legenda.
    *   *Infra:* Implementar **Garbage Collection**. Excluir imagens e áudios temporários IMEDIATAMENTE após gerar o MP4. Enviar MP4 para S3 (Opcional) e apagar do disco local.
3.  **Serviço 3 - Publicador (Upload):**
    *   *Ferramentas:* YouTube Data API, TikTok API, Graph API.
    *   *Tarefa:* Upload de vídeo e metadados. Monitoramento A/B inicial (troca thumb após 3h se necessário).
4.  **Serviço 4 - Agente de Engajamento (Cron):**
    *   *Ferramentas:* Node-cron / Consultas de Analytics.
    *   *Tarefa:* Roda 1x ao dia. Puxa views/likes dos últimos 30 dias. Usa IA para resumir "o que deu certo" e atualiza a tabela `canal_inteligencia`.
5.  **Serviço 5 - Dashboard (BFF - Backend for Frontend):**
    *   *Tarefa:* Servir API RESTful (GET/POST) leve com paginação. Não deve executar processos pesados.

## 3. Resiliência de Rede
*   **Exponential Backoff:** Qualquer integração externa (YouTube, Gemini) deve usar blocos `try/catch`. Em caso de erro `429 (Too Many Requests)` ou `500`, aguardar `5s -> 15s -> 60s` antes de falhar definitivamente e logar o erro.