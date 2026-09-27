-- =============================================
-- DDL - Pipeline de Vídeos Automatizados
-- =============================================

CREATE TABLE IF NOT EXISTS canais (
    id_canal INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    nicho VARCHAR(100) NOT NULL,
    token_youtube VARCHAR(255),
    token_tiktok VARCHAR(255),
    token_instagram VARCHAR(255),
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tipos_video_templates (
    id_tipo INT AUTO_INCREMENT PRIMARY KEY,
    nome_estilo VARCHAR(100) NOT NULL UNIQUE,
    prompt_base TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS videos_pipeline (
    id_video INT AUTO_INCREMENT PRIMARY KEY,
    id_canal INT NOT NULL,
    id_tipo INT NULL,
    modo_operacao ENUM('MANUAL', 'AUTOMATICO') DEFAULT 'MANUAL',
    status ENUM(
        'BUSCANDO_TEMA',
        'AGUARDANDO_APROVACAO_ROTEIRO',
        'GERANDO_MIDIA',
        'AGUARDANDO_APROVACAO_VIDEO',
        'AGENDADO',
        'PUBLICANDO',
        'CONCLUIDO',
        'FALHA'
    ) DEFAULT 'BUSCANDO_TEMA',
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
    FOREIGN KEY (id_canal) REFERENCES canais(id_canal),
    FOREIGN KEY (id_tipo) REFERENCES tipos_video_templates(id_tipo)
);

CREATE TABLE IF NOT EXISTS canal_inteligencia (
    id_inteligencia INT AUTO_INCREMENT PRIMARY KEY,
    id_canal INT NOT NULL UNIQUE,
    melhor_estilo_gancho TEXT,
    temas_saturados JSON,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_canal) REFERENCES canais(id_canal)
);

CREATE TABLE IF NOT EXISTS dicionario_erros (
    codigo_erro VARCHAR(20) PRIMARY KEY,
    modulo VARCHAR(100) NOT NULL,
    descricao TEXT NOT NULL,
    acao_recuperacao TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS logs_erros (
    id_log INT AUTO_INCREMENT PRIMARY KEY,
    id_video INT NOT NULL,
    codigo_erro VARCHAR(20) NOT NULL,
    detalhes_tecnicos TEXT,
    resolvido BOOLEAN DEFAULT FALSE,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_video) REFERENCES videos_pipeline(id_video),
    FOREIGN KEY (codigo_erro) REFERENCES dicionario_erros(codigo_erro)
);

-- =============================================
-- Seed - Dicionário de Erros
-- =============================================

INSERT INTO dicionario_erros (codigo_erro, modulo, descricao, acao_recuperacao) VALUES
('ERR-IA-001',  'Ideação',    'Falha na IA / JSON inválido retornado pelo Gemini',         'Retry automático em 5s (máximo 3 tentativas)'),
('ERR-IA-002',  'Ideação',    'Roteiro com tempo fora do limite (20s-40s)',                 'Re-prompt automático pedindo ajuste de tamanho'),
('ERR-MED-101', 'Mídia',      'Falha na API de voz ou imagem (ElevenLabs/DALL-E)',         'Retry com exponential backoff'),
('ERR-MED-103', 'Mídia',      'FFmpeg falhou ou estouro de RAM durante renderização',      'Logar erro, liberar recursos e marcar como FALHA'),
('ERR-PUB-201', 'Publicador', 'Token de upload expirado ou inválido',                      'Solicitar refresh do token e retry');
