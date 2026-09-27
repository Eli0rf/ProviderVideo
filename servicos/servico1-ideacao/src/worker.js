const db = require('./db');
const gemini = require('./gemini');

const DURACAO_MIN = 20;
const DURACAO_MAX = 40;
const MAX_RETRIES_JSON = 3;
const MAX_REAJUSTES = 3;

/**
 * Processa um job de ideação para um vídeo.
 * @param {object} job - Job do BullMQ com data.idVideo e data.promptOverride (opcional)
 */
async function processarIdeacao(job) {
  const { idVideo, promptOverride } = job.data;
  console.log(`[Worker] Processando vídeo id=${idVideo}`);

  const video = await db.getVideo(idVideo);
  if (!video) {
    throw new Error(`Vídeo id=${idVideo} não encontrado`);
  }

  if (video.status !== 'BUSCANDO_TEMA') {
    console.log(`[Worker] Vídeo id=${idVideo} não está em BUSCANDO_TEMA (status=${video.status}). Ignorando.`);
    return;
  }

  const canal = await db.getCanal(video.id_canal);
  if (!canal) {
    throw new Error(`Canal id=${video.id_canal} não encontrado`);
  }

  const inteligencia = await db.getInteligenciaCanal(video.id_canal);
  const template = await db.getTemplate(video.id_tipo);

  // Monta prompt inicial
  const promptCompleto = gemini.montarPrompt(canal, inteligencia, template, promptOverride || null);

  // Chama Gemini com retry para JSON inválido (ERR-IA-001)
  let dados = null;
  for (let tentativa = 1; tentativa <= MAX_RETRIES_JSON; tentativa++) {
    try {
      dados = await gemini.chamarGemini(promptCompleto);
      // Mapeia caso o Gemini tenha retornado roteiro_narracao (novo schema) ou roteiro (antigo)
      if (dados.roteiro_narracao && !dados.roteiro) {
        dados.roteiro = dados.roteiro_narracao;
      }
      validarEstrutura(dados);
      break;
    } catch (err) {
      console.error(`[Worker] Tentativa ${tentativa}/${MAX_RETRIES_JSON} falhou: ${err.message}`);
      if (tentativa === MAX_RETRIES_JSON) {
        await db.inserirLogErro(idVideo, 'ERR-IA-001', err.message);
        await db.marcarFalha(idVideo);
        throw new Error(`ERR-IA-001: Falha após ${MAX_RETRIES_JSON} tentativas - ${err.message}`);
      }
      // Retry em 5s
      await sleep(5000);
    }
  }

  // Validação de duração (20s - 40s) com re-prompt automático (ERR-IA-002)
  for (let reajuste = 0; reajuste < MAX_REAJUSTES; reajuste++) {
    const duracao = gemini.calcularDuracao(dados.roteiro);
    console.log(`[Worker] Duração estimada: ${duracao.toFixed(1)}s (alvo: ${DURACAO_MIN}-${DURACAO_MAX}s)`);

    if (duracao >= DURACAO_MIN && duracao <= DURACAO_MAX) {
      break;
    }

    console.warn(`[Worker] Duração fora do limite. Re-prompt ${reajuste + 1}/${MAX_REAJUSTES}`);

    if (reajuste === MAX_REAJUSTES - 1) {
      await db.inserirLogErro(idVideo, 'ERR-IA-002', `Duração ${duracao.toFixed(1)}s após ${MAX_REAJUSTES} reajustes`);
      await db.marcarFalha(idVideo);
      throw new Error(`ERR-IA-002: Roteiro com duração ${duracao.toFixed(1)}s, fora de ${DURACAO_MIN}-${DURACAO_MAX}s após ${MAX_REAJUSTES} tentativas`);
    }

    const promptReajuste = gemini.montarPromptReajuste(dados.roteiro, duracao, DURACAO_MIN, DURACAO_MAX);
    dados = await gemini.chamarGemini(promptReajuste);
    validarEstrutura(dados);
  }

  // Determina próximo status baseado no modo de operação
  const novoStatus = video.modo_operacao === 'AUTOMATICO'
    ? 'GERANDO_MIDIA'
    : 'AGUARDANDO_APROVACAO_ROTEIRO';

  // Persiste no banco
  await db.atualizarVideoComRoteiro(idVideo, dados, novoStatus);

  const durFinal = gemini.calcularDuracao(dados.roteiro);
  console.log(`[Worker] ✅ Vídeo id=${idVideo} atualizado -> status=${novoStatus} (duração=${durFinal.toFixed(1)}s)`);

  return {
    idVideo,
    status: novoStatus,
    tema: dados.tema,
    titulo: dados.titulo,
    duracao: durFinal,
  };
}

/**
 * Valida que o JSON retornado tem todos os campos obrigatórios.
 */
function validarEstrutura(dados) {
  const camposObrigatorios = ['tema', 'titulo', 'roteiro', 'prompt_imagens', 'humor_trilha', 'hashtags', 'variacoes_teste_ab'];

  for (const campo of camposObrigatorios) {
    if (dados[campo] === undefined || dados[campo] === null) {
      throw new Error(`Campo obrigatório "${campo}" ausente no JSON da IA`);
    }
  }

  if (!Array.isArray(dados.prompt_imagens) || dados.prompt_imagens.length === 0) {
    throw new Error('prompt_imagens deve ser um array não vazio');
  }

  const abCampos = ['titulo_a', 'titulo_b', 'thumb_prompt_a', 'thumb_prompt_b'];
  for (const campo of abCampos) {
    if (!dados.variacoes_teste_ab || !dados.variacoes_teste_ab[campo]) {
      throw new Error(`Campo A/B "${campo}" ausente em variacoes_teste_ab`);
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { processarIdeacao };
