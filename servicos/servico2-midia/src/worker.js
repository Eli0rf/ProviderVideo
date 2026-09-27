const fs = require('fs');
const path = require('path');
const db = require('./db');
const { gerarAudioTTS } = require('./audio');
const { baixarImagensMock } = require('./imagens');
const { renderizarVideo } = require('./ffmpeg');

const OUTPUT_DIR = process.env.OUTPUT_DIR || './output';

/**
 * Processa um job de mídia para um vídeo.
 */
async function processarMidia(job) {
  const { idVideo } = job.data;
  console.log(`[Worker] Processando mídia para vídeo id=${idVideo}`);

  const video = await db.getVideo(idVideo);
  if (!video) throw new Error(`Vídeo id=${idVideo} não encontrado`);

  if (video.status !== 'GERANDO_MIDIA') {
    console.log(`[Worker] Vídeo id=${idVideo} não está em GERANDO_MIDIA. Ignorando.`);
    return;
  }

  const tmpDir = path.resolve(`./tmp/video_${idVideo}`);
  const outDir = path.resolve(OUTPUT_DIR);
  
  const audioPath = path.join(tmpDir, 'temp_audio.mp3');
  const videoFinalPath = path.join(outDir, `video_${idVideo}.mp4`);

  try {
    // 1. Áudio TTS (Voz Humana Real / OpenAI)
    console.log('[Worker] Etapa 1/3: Gerando áudio TTS (Voz Real)...');
    const duracao = await gerarAudioTTS(video.roteiro, audioPath);

    // 2. Imagens Realistas
    console.log('[Worker] Etapa 2/3: Baixando imagens realistas...');
    const prompts = typeof video.prompt_imagens === 'string'
      ? JSON.parse(video.prompt_imagens)
      : video.prompt_imagens;
    const imagePaths = await baixarImagensMock(prompts, tmpDir); // Poderia ser DALL-E em prod

    // 3. Renderização (FFmpeg Vertical + Legendas dinâmicas + Ken Burns)
    console.log('[Worker] Etapa 3/3: Renderizando vídeo + Legendas...');
    await renderizarVideo(imagePaths, audioPath, videoFinalPath, duracao, video.roteiro);

    // 4. ATUALIZAÇÃO BANCO DE DADOS
    const novoStatus = video.modo_operacao === 'AUTOMATICO'
      ? 'AGENDADO'
      : 'AGUARDANDO_APROVACAO_VIDEO';

    await db.atualizarVideoFinalizado(idVideo, videoFinalPath, novoStatus);
    console.log(`[Worker] ✅ Vídeo finalizado. Status -> ${novoStatus}`);

  } catch (err) {
    console.error(`[Worker] ❌ Erro:`, err.message);
    const codErro = (err.message.includes('ffmpeg') || err.message.includes('subtitles')) ? 'ERR-MED-103' : 'ERR-MED-101';
    await db.inserirLogErro(idVideo, codErro, err.message);
    await db.marcarFalha(idVideo);
    throw err;
  } finally {
    // 5. GARBAGE COLLECTION RIGOROSO (sempre executa, com sucesso ou erro)
    console.log(`[Worker] 🗑️ Iniciando Garbage Collection na pasta: ${tmpDir}`);
    try {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        console.log(`[Worker] 🧹 Garbage Collection: removida pasta inteira e ficheiros temporários em ${tmpDir}`);
      }
    } catch (e) {
      console.warn(`[Worker] ⚠️ Falha térmica no Garbage Collection: ${e.message}`);
    }
  }
}

module.exports = { processarMidia };
