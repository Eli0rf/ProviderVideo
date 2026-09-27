const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SCHEMA_INSTRUCAO = `
Você DEVE responder EXCLUSIVAMENTE com um JSON válido, sem markdown, sem comentários, sem texto extra.
O JSON deve seguir EXATAMENTE esta estrutura:
{
  "tema": "string — tema/assunto do vídeo",
  "titulo": "string — título chamativo para YouTube/TikTok",
  "roteiro": "string — roteiro narrado completo (entre 50 e 100 palavras para ficar entre 20s e 40s a 2.5 palavras/segundo)",
  "prompt_imagens": ["string — prompt descritivo para gerar cada imagem/cena do vídeo"],
  "humor_trilha": "string — humor/mood da trilha sonora (ex: épico, misterioso, alegre, tenso)",
  "hashtags": "string — hashtags separadas por espaço",
  "variacoes_teste_ab": {
    "titulo_a": "string — variação A do título",
    "titulo_b": "string — variação B do título",
    "thumb_prompt_a": "string — prompt de thumbnail variação A",
    "thumb_prompt_b": "string — prompt de thumbnail variação B"
  }
}`;

/**
 * Monta o prompt completo com contexto do canal e inteligência.
 */
function montarPrompt(canal, inteligencia, template, promptOverride) {
  let contexto = `Você é um roteirista especialista em vídeos curtos virais para o nicho "${canal.nicho}".\n`;

  if (inteligencia) {
    if (inteligencia.melhor_estilo_gancho) {
      contexto += `\nUse esses padrões de sucesso como referência de gancho: ${inteligencia.melhor_estilo_gancho}`;
    }
    if (inteligencia.temas_saturados) {
      const saturados = typeof inteligencia.temas_saturados === 'string'
        ? inteligencia.temas_saturados
        : JSON.stringify(inteligencia.temas_saturados);
      contexto += `\nEvite estes temas saturados: ${saturados}`;
    }
  }

  if (template && template.prompt_base) {
    contexto += `\n\nEstilo de vídeo solicitado: "${template.nome_estilo}"\nInstruções do template: ${template.prompt_base}`;
  }

  if (promptOverride) {
    contexto += `\n\nInstrução direta do usuário (prioridade máxima): ${promptOverride}`;
  } else {
    contexto += `\n\nCrie um tema original e viral para o canal "${canal.nome}" no nicho "${canal.nicho}".`;
  }

  contexto += `\n\n${SCHEMA_INSTRUCAO}`;

  return contexto;
}

/**
 * Prompt de re-ajuste quando duração fica fora de 20-40s.
 */
function montarPromptReajuste(roteiroAtual, duracaoAtual, min, max) {
  const direcao = duracaoAtual < min ? 'MAIS LONGO' : 'MAIS CURTO';
  return `O roteiro anterior tinha ${duracaoAtual.toFixed(1)}s (precisa estar entre ${min}s e ${max}s).
Reescreva o roteiro ${direcao}, mantendo o mesmo tema, tom e qualidade.
Roteiro anterior: "${roteiroAtual}"

${SCHEMA_INSTRUCAO}`;
}

/**
 * Chama Gemini e parseia JSON. Retry com exponential backoff em 429/500.
 */
async function chamarGemini(prompt) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const backoffDelays = [5000, 15000, 60000]; // 5s -> 15s -> 60s

  for (let tentativa = 0; tentativa <= backoffDelays.length; tentativa++) {
    try {
      const result = await model.generateContent(prompt);
      const texto = result.response.text();

      // Limpa possíveis marcadores markdown
      const jsonLimpo = texto
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      const parsed = JSON.parse(jsonLimpo);
      return parsed;
    } catch (err) {
      const status = err?.status || err?.response?.status;
      const isRetryable = status === 429 || status === 500 || status >= 500;

      if (isRetryable && tentativa < backoffDelays.length) {
        const delay = backoffDelays[tentativa];
        console.warn(`[Gemini] Erro ${status}, retry em ${delay / 1000}s (tentativa ${tentativa + 1}/${backoffDelays.length})`);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calcula duração estimada do roteiro em segundos.
 * Regra: 2.5 palavras por segundo.
 */
function calcularDuracao(roteiro) {
  const palavras = roteiro.trim().split(/\s+/).length;
  return palavras / 2.5;
}

module.exports = {
  montarPrompt,
  montarPromptReajuste,
  chamarGemini,
  calcularDuracao,
};
