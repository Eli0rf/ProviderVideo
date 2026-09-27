# Regras de Negócio e Restrições (Business Rules)
**Objetivo:** Ditar o comportamento do sistema e validações antes de gravar no banco.

## 1. Regras de Operação e Fluxo
*   **Modo Manual (Human-in-the-Loop):** O status DEVE pausar em `AGUARDANDO_APROVACAO_ROTEIRO` e `AGUARDANDO_APROVACAO_VIDEO`. O sistema só avança via request do Dashboard.
*   **Modo Automático:** Pula aprovações. `ROTEIRO_GERADO` vira `GERANDO_MIDIA`; `VIDEO_RENDERIZADO` vira `AGENDADO`.
*   **Criação Direta (Override):** O usuário pode inserir um prompt manual via Dashboard. Isso pula o "BUSCANDO_TEMA" e instrui a IA a ir direto para o Roteiro.

## 2. Validação Estrita (Limites e Qualidade)
*   **Regra do Tempo (20s - 40s):** O roteiro gerado pelo Gemini deve ser calculado (2.5 palavras por segundo). Se for menor que 20s ou maior que 40s, a IA desenvolvedora DEVE programar um re-prompt automático pedindo ajuste, ANTES de avançar para a geração de áudio.

## 3. Comportamento em Falhas (Fallback)
*   Nunca travar a fila de processamento inteira por causa de um vídeo.
*   Se ocorrer exceção/erro, o status do vídeo vai para `FALHA`.
*   O erro deve ser mapeado na tabela `logs_erros` utilizando os seguintes códigos:
    *   `ERR-IA-001` (Falha na IA/JSON inválido). Ação: Retry em 5s (max 3x).
    *   `ERR-IA-002` (Tempo fora do limite).
    *   `ERR-MED-101` (Falha de API de voz/imagem).
    *   `ERR-MED-103` (FFmpeg falhou / Estouro de RAM).
    *   `ERR-PUB-201` (Token Upload expirado).

## 4. Teste A/B e Aprendizado
*   **Testes:** Sempre gerar Título e Thumb A e B (salvos no banco). O sistema usa A. Após 3h, verifica CTR. Se baixo, troca para B via API do YouTube.
*   **Aprendizado:** A IA deve sempre consultar a tabela `canal_inteligencia` e adicionar o conteúdo dela ao prompt de contexto ("Use esses padrões de sucesso e evite estes temas").