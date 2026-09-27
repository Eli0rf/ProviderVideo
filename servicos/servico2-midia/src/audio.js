const fs = require('fs');
const path = require('path');
const { getAudioDurationInSeconds } = require('get-audio-duration');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-mock-key' // Espera chave real em prod
});

/**
 * Gera um áudio MP3 de alta qualidade a partir do roteiro usando OpenAI TTS.
 * 
 * @param {string} roteiro - Texto do roteiro
 * @param {string} outputPath - Caminho de saída do MP3
 * @returns {Promise<number>} duração em segundos
 */
async function gerarAudioTTS(roteiro, outputPath) {
  console.log(`[Áudio] Gerando áudio via TTS (OpenAI): ${roteiro.length} caracteres`);

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      console.warn('[Áudio] ⚠️ OPENAI_API_KEY não encontrada. Usando TTS Mock.');
      return gerarAudioMockFalso(roteiro, outputPath);
    }

    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: "onyx", // Voz masculina profunda, boa para narrativa/curiosidades
      input: roteiro,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    fs.writeFileSync(outputPath, buffer);
    
    // Calcula a duração real do MP3 recém-gerado
    const duracao = await extrairDuracaoMP3(outputPath);
    console.log(`[Áudio] ✅ TTS gerado com sucesso: ${duracao.toFixed(2)}s`);
    return duracao;

  } catch (error) {
    console.error(`[Áudio] Falha no TTS OpenAI: ${error.message}`);
    throw error;
  }
}

/**
 * Extrai duração do arquivo MP3 usando ffmpeg (ffprobe) de forma limpa
 */
function extrairDuracaoMP3(filePath) {
  return new Promise((resolve, reject) => {
    try {
      const ffmpeg = require('fluent-ffmpeg');
      ffmpeg.ffprobe(filePath, function(err, metadata) {
        if (err) return reject(err);
        resolve(metadata.format.duration);
      });
    } catch (e) {
      // Fallback estático se der erro
      console.warn('[Áudio] ⚠️ Não foi possível extrair duração do ffprobe, usando fallback. Erro:', e.message);
      resolve(15); 
    }
  });
}

/**
 * Mock (fallback) para testes caso não tenha API Key
 */
function gerarAudioMockFalso(roteiro, outputPath) {
  const { execSync } = require('child_process');
  const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
  
  const palavras = roteiro.trim().split(/\s+/).length;
  const duracao = Math.max(5, Math.round(palavras / 2.5));

  execSync(
    `"${ffmpegInstaller.path}" -y -f lavfi -i "sine=frequency=440:duration=${duracao}" -ac 1 -ar 44100 -b:a 128k "${outputPath}"`,
    { stdio: 'pipe' }
  );

  return duracao;
}

module.exports = { gerarAudioTTS };
