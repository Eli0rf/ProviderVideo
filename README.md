# 🚀 Canal Dark Automatizado (Viral Video Factory)

![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-005C84?style=for-the-badge&logo=mysql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2CA5E0?style=for-the-badge&logo=docker&logoColor=white)
![FFmpeg](https://img.shields.io/badge/FFmpeg-007808?style=for-the-badge&logo=ffmpeg&logoColor=white)

Uma arquitetura de ponta baseada em **Microsserviços** para idealização, geração, renderização e postagem 100% automatizada de vídeos virais focados no formato Short-form (TikTok, YouTube Shorts, e Reels).

---

## 📌 Arquitetura de Microsserviços

O pipeline é quebrado em serviços independentes que se comunicam através do banco de dados MySQL e enfileiramento ágil via **Redis + BullMQ**.

### 1. Serviço de Ideação (`servico1-ideacao`)
Responsável por consumir motores de IA (Gemini Open-source) para criar pautas atraentes baseadas em 3 pilares de engajamento (*Hook Retentivo*, *Corpo Curioso* e *CTA forte*).
- **Entrada:** Cron de tendências / Acionamento manual.
- **Saída:** Roteiro validado em JSON + Prompts Fotorrealistas formatados (DALL-E/Midjourney spec) salvos no MySQL (`status='GERANDO_MIDIA'`).

### 2. Motor de Mídia (`servico2-midia`) 🎬
Sistema robusto em FFMPEG via stream de processamento.
- **Áudio TTS:** Conecta na API da OpenAI (Voz "Onyx") gerando locução extremamente humana. (Possui fallback nativo automático via beep `440hz` em caso de falta de chave API para não atrasar o desenvolvimento local).
- **Processamento de Magia:** Baixa imagens e submete a um `complex_filter` interno garantindo enquadramento **9:16 vertical** (720x1280), aplicando dinâmico **Ken Burns effect** (zoom leve contínuo) para alta retenção.
- **Legendas:** Calcula espaçamento sonoro e gera .SRT em runtime, injetando *hard-subs* enormes (borda preta, Arial 24) desenhadas na tela antes do encode H.264 final.
- **Garbage Collection Extremo:** Limpeza cirúrgica (`tmp/`) garantida para evitar estouros de cache no SSD em alto scale server.

### 3. Distribuição (`servico3-postagem`) 🚧 _Em breve_
Serviço Worker que escutará diretórios `output/video_X.mp4`, injetará meta-tags e usará OAuth2.0 do YouTube Studio API e TikTok Graph para efetuar os uploads baseando-se nos melhores horários virais.

---

## 💻 Tech Stack & Requisitos

- **Ambiente Centralizado:** Docker e Docker-compose.
- **DB & Filas:** MySQL 8+ (Schema persistido) e Redis.
- **Back-end:** Node.js v18+ nativo.
- **Ferramentas Visuais:** FFMPEG local (fluent-ffmpeg integrado ao binário cross-platform).

---

## ⚙️ Como Rodar (Ambiente Local)

**1. Subindo Bancos e Filas**
```bash
docker-compose up -d
```
*(Isso vai levantar instantaneamente sua estância MySQL, rodar o `init.sql` construindo o SCHEMA de pipeline e levantar o Redis pro BullMQ).*

**2. Instalando Dependências**
```bash
# Serviço 1
cd servicos/servico1-ideacao && npm install

# Serviço 2
cd servicos/servico2-midia && npm install
```

**3. Configurando .env**
Certifique-se de configurar em ambos os serviços suas chaves de IA (ex: `OPENAI_API_KEY`, `GEMINI_API_KEY`). O Worker 2 sabe usar *Mocks* se as chaves da OpenAI e Imagem não existirem, mas o gemini é fundamental no serviço 1.

**4. Rodando os Workers**
Em abas de terminais separadas, inicie os gatilhos:
```bash
npm run start # no servico1-ideacao
npm run start # no servico2-midia
```

---

## 📈 Status do Projeto / Roadmap

- [x] **Fase 1:** Mapeamento Arquitetural, Banco de dados e Docker Compose.
- [x] **Fase 2:** IA Core (Gemini) redigindo roteiros dinâmicos.
- [x] **Fase 3:** Sistema do Worker 1 transicionando de `IDEACAO` para pipeline de fila Redis.
- [x] **Fase 4:** Worker Mídia injetando **OpenAI TTS**, processando H.264 (KenBurns dinâmico) e hardsubs em formato Vertical sem lockar fila.
- [ ] **Fase 5:** Painel Web React/Next.js (ou Bot Telegram) para aprovação manual (`AGUARDANDO_APROVACAO_VIDEO`).
- [ ] **Fase 6:** Worker de Postagem Automática nas Redes Sociais.

---
*Powered by Deepmind AI Agentic Coding pipeline.*