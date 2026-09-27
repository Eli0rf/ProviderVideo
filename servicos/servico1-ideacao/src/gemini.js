const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SCHEMA_INSTRUCAO = `
Você DEVE responder EXCLUSIVAMENTE com um JSON válido, sem blocos de código markdown (\`\`\`json), sem comentários e sem texto adicional.
O JSON deve seguir EXATAMENTE esta estrutura:
{
  "tema": "string — tema/assunto principal do vídeo",
  "titulo": "string — título chamativo e altamente clicável",
  "roteiro": "string — roteiro narrado completo, gancho forte nos primeiros 3s (50 a 100 palavras para 20-40s a 2.5 palavras/s)",
  "humor_trilha": "string — humor/mood da trilha sonora",
  "prompt_imagens": [
    "string — prompt cena 1, exigindo obrigatoriamente estilo fotorrealista cinematográfico (Hyper-realistic 8k, cinematic dramatic lighting, National Geographic style, photorealistic)",
    "string — prompt cena 2 com padrão fotorrealista",
    "string — prompt cena 3 com padrão fotorrealista"
  ],
  "variacoes_teste_ab": {
    "titulo_a": "string — variação A",
    "titulo_b": "string — variação B",
    "thumb_prompt_a": "string — prompt fotorrealista thumbnail A",
    "thumb_prompt_b": "string — prompt fotorrealista thumbnail B"
  },
  "hashtags": "string — hashtags separadas por espaço"
}`;

/**
 * Monta o prompt especializado por pilar (História/Ciência, Visual Cinematográfico, Promoção/Monetização) e inteligência.
 */
function montarPrompt(canal, inteligencia, template, promptOverride, subcategoria = 'GERAL') {
  let pilarInstrucao = '';
  const sub = (subcategoria || canal.nicho || 'GERAL').toUpperCase();

  if (sub.includes('HISTORIA') || sub.includes('HISTÓRIA') || sub.includes('CIENCIA') || sub.includes('CIÊNCIA')) {
    pilarInstrucao = `
[PILAR 1: CURIOSIDADES CIENTÍFICAS E HISTÓRICAS DE ALTA RETENÇÃO]
- Foco em revelações surpreendentes, fatos desconhecidos ou paradoxos históricos/científicos.
- O gancho inicial (0-3 segundos) deve quebrar um mito ou lançar uma pergunta perturbadora.
- Ritmo dinâmico, mantendo alta retenção segundo a segundo.`;
  } else if (sub.includes('PROMO') || sub.includes('MONETIZACAO') || sub.includes('PRODUTO')) {
    pilarInstrucao = `
[PILAR 3: PROMOÇÃO DE PRODUTOS E MONETIZAÇÃO]
- Foco em conversão, resolução imediata de uma dor urgente do cliente.
- Gancho com apelo de transformação rápida ou benefício inegável.
- CTA magnética no final do roteiro.`;
  } else {
    pilarInstrucao = `
[PILAR 2: VISUAL FOTORREALISTA E CINEMATOGRÁFICO]
- Foco em imersão visual profunda, narrativa instigante e estética cinematográfica de altíssimo nível.`;
  }

  let contexto = `Você é um roteirista sênior especialista em vídeos curtos virais (TikTok, Reels, Shorts) para o canal "${canal.nome}" (${canal.nicho}).\n`;
  contexto += pilarInstrucao;

  if (inteligencia) {
    if (inteligencia.melhor_estilo_gancho) {
      contexto += `\nPadrões de gancho de sucesso comprovados pelo canal: ${inteligencia.melhor_estilo_gancho}`;
    }
    if (inteligencia.temas_saturados) {
      const saturados = typeof inteligencia.temas_saturados === 'string'
        ? inteligencia.temas_saturados
        : JSON.stringify(inteligencia.temas_saturados);
      contexto += `\nEVITE absolutamente estes temas já saturados: ${saturados}`;
    }
  }

  if (template && template.prompt_base) {
    contexto += `\nEstilo/Template do vídeo: ${template.prompt_base}`;
  }

  contexto += `\n\nREQUISITO VISUAL OBRIGATÓRIO (PADRÃO FOTORREALISTA): Todos os prompts em 'prompt_imagens', 'thumb_prompt_a' e 'thumb_prompt_b' DEVEM ser descrições detalhadas exigindo alta qualidade fotorrealista e cinematográfica, utilizando obrigatoriamente termos como: "Hyper-realistic 8k, cinematic dramatic lighting, National Geographic style, photorealistic, ultra-detailed". NUNCA use estilos cartoon, infantis ou desenhos genéricos.`;

  if (promptOverride) {
    contexto += `\n\nTema ou diretriz específica fornecida: "${promptOverride}"`;
  } else {
    contexto += `\n\nCrie um tema inédito, viral e altamente magnético dentro do nicho do canal.`;
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
  const model = genAI.getGenerativeModel({ model: 'gemini-3.8-flash' });
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
