# Estrutura do Banco de Dados (MySQL)
**Objetivo:** Fonte única de verdade do sistema. Relacional, focado em integridade.

## 1. Dicionário de Tabelas e Relacionamentos

*   **`canais`**: (1:N com videos, 1:1 com inteligencia)
    *   `id_canal` (INT, PK, AI)
    *   `nome` (VARCHAR 100), `nicho` (VARCHAR 100)
    *   `token_youtube`, `token_tiktok`, `token_instagram` (VARCHAR 255) -> *NOTA PARA A IA: Sempre criptografar/descriptografar via AES-256 no backend.*
*   **`tipos_video_templates`**: (1:N com videos)
    *   `id_tipo` (INT, PK, AI)
    *   `nome_estilo` (VARCHAR 100, UNIQUE), `prompt_base` (TEXT)
*   **`videos_pipeline`**: (Tabela Central)
    *   `id_video` (INT, PK, AI)
    *   `id_canal` (INT, FK)
    *   `id_tipo` (INT, FK, NULL)
    *   `modo_operacao` (ENUM: 'MANUAL', 'AUTOMATICO') -> Padrão: 'MANUAL'.
    *   `status` (ENUM: 'BUSCANDO_TEMA', 'AGUARDANDO_APROVACAO_ROTEIRO', 'GERANDO_MIDIA', 'AGUARDANDO_APROVACAO_VIDEO', 'AGENDADO', 'PUBLICANDO', 'CONCLUIDO', 'FALHA')
    *   `plataformas_alvo` (JSON)
    *   `tema`, `titulo`, `hashtags` (VARCHAR)
    *   `roteiro` (TEXT)
    *   `humor_trilha` (VARCHAR 50)
    *   `prompt_imagens`, `variacoes_teste_ab`, `metricas_engajamento` (JSON)
    *   `url_video_final`, `url_thumbnail` (VARCHAR)
    *   `data_agendamento` (DATETIME)
*   **`canal_inteligencia`**: (Loop de Machine Learning)
    *   `id_inteligencia` (INT, PK, AI)
    *   `id_canal` (INT, FK, UNIQUE)
    *   `melhor_estilo_gancho` (TEXT)
    *   `temas_saturados` (JSON)
*   **`dicionario_erros`** e **`logs_erros`**:
    *   `dicionario` (Estático): `codigo_erro` (PK), `modulo`, `descricao`, `acao_recuperacao`.
    *   `logs` (Dinâmico): `id_log` (PK), `id_video` (FK), `codigo_erro` (FK), `detalhes_tecnicos` (TEXT), `resolvido` (BOOLEAN).

## 2. Script SQL Inicial (DDL)
```sql
CREATE TABLE canais (
    id_canal INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    nicho VARCHAR(100) NOT NULL,
    token_youtube VARCHAR(255),
    token_tiktok VARCHAR(255),
    token_instagram VARCHAR(255),
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE videos_pipeline (
    id_video INT AUTO_INCREMENT PRIMARY KEY,
    id_canal INT NOT NULL,
    modo_operacao ENUM('MANUAL', 'AUTOMATICO') DEFAULT 'MANUAL',
    status ENUM('BUSCANDO_TEMA', 'AGUARDANDO_APROVACAO_ROTEIRO', 'GERANDO_MIDIA', 'AGUARDANDO_APROVACAO_VIDEO', 'AGENDADO', 'PUBLICANDO', 'CONCLUIDO', 'FALHA') DEFAULT 'BUSCANDO_TEMA',
    plataformas_alvo JSON NOT NULL,
    tema VARCHAR(255),
    titulo VARCHAR(255),
    roteiro TEXT,
    prompt_imagens JSON,
    variacoes_teste_ab JSON,
    humor_trilha VARCHAR(50),
    hashtags VARCHAR(255),
    url_video_final VARCHAR(255),
    url_thumbnail VARCHAR(255),
    data_agendamento DATETIME NULL,
    metricas_engajamento JSON NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_canal) REFERENCES canais(id_canal)
);