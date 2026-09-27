const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

// Diz ao fluent-ffmpeg para usar o binário local em vez do sistema operacional
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const fs = require('fs');
const path = require('path');

/**
 * Gera arquivo .srt dinâmico (legendas queimadas simuladas) para usar no FFmpeg
 */
function gerarLegendasSrt(roteiro, duracaoTotal, outputPath) {
  const palavras = roteiro.replace(/\n/g, ' ').split(/\s+/).filter(p => p.length > 0);
  const duracaoPalavra = duracaoTotal / palavras.length;
  let srtContent = '';
  
  // Agrupa em blocos de 3-4 palavras (estilo viral de TikTok/Shorts)
  const palavrasPorBloco = 4;
  let srtIndex = 1;
  
  for (let i = 0; i < palavras.length; i += palavrasPorBloco) {
    const chunk = palavras.slice(i, i + palavrasPorBloco).join(' ');
    
    // Tempo start/end
    const startTime = (i * duracaoPalavra);
    const endTime = Math.min(((i + palavrasPorBloco) * duracaoPalavra), duracaoTotal);
    
    const formatTime = (timeInSecs) => {
      const h = Math.floor(timeInSecs / 3600).toString().padStart(2, '0');
      const m = Math.floor((timeInSecs % 3600) / 60).toString().padStart(2, '0');
      const s = Math.floor(timeInSecs % 60).toString().padStart(2, '0');
      const ms = Math.floor((timeInSecs % 1) * 1000).toString().padStart(3, '0');
      return `${h}:${m}:${s},${ms}`;
    };

    srtContent += `${srtIndex}\n`;
    srtContent += `${formatTime(startTime)} --> ${formatTime(endTime)}\n`;
    srtContent += `${chunk.toUpperCase()}\n\n`;
    srtIndex++;
  }
  
  const srtPath = outputPath.replace('.mp4', '.srt');
  fs.writeFileSync(srtPath, srtContent);
  return srtPath;
}

/**
 * Renderiza vídeo final juntando imagens (com Ken Burns) + áudio + legendas (Drawtext) vertical
 */
function renderizarVideo(imagePaths, audioPath, outputPath, duracaoTotal, roteiro) {
  return new Promise((resolve, reject) => {
    const numImagens = imagePaths.length;
    const duracaoPorImagem = duracaoTotal / numImagens;
    const fps = 30;
    const framesPorImagem = duracaoPorImagem * fps;

    console.log(`[FFmpeg] Renderizando: ${numImagens} imagens x ${duracaoPorImagem.toFixed(2)}s = ${duracaoTotal}s`);

    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // --- Filtro Complexo ---
    const inputs = [];
    const filterParts = [];
    const concatInputs = [];

    // Formato Vertical: 720x1280
    const w = 720;
    const h = 1280;

    for (let i = 0; i < numImagens; i++) {
      inputs.push(imagePaths[i]);
      // Ken Burns: Scale para crop preencher o 9:16, e dar um leve zoom-in
      // (aumento gradual contínuo da imagem em si em relação à tela)
      filterParts.push(
        `[${i}:v]scale='max(${w},iw*${h}/ih)':'max(${h},ih*${w}/iw)',crop=${w}:${h}:'(in_w-${w})/2':'(in_h-${h})/2',setsar=1,zoompan=z='min(zoom+0.0015\\,1.2)':d=${framesPorImagem}:s=${w}x${h}:fps=${fps}[v${i}]`
      );
      concatInputs.push(`[v${i}]`);
    }

    let filterComplex = filterParts.join('; ') + `; ${concatInputs.join('')}concat=n=${numImagens}:v=1:a=0[outv]`;

    let command = ffmpeg();
    for (const img of inputs) {
      command = command.input(img).inputOptions(['-loop', '1']);
    }
    command = command.input(audioPath);

    // Usa drawtext dinâmico (substituto pro modulo "subtitles" que depende do binário do SO compilado com libass)
    // O texto fica centralizado e grande na tela. Pra facilitar vamos aplicar no command final.
    
    // Gerar SRT dinâmico para usar c/ drawtext ou subtitles (se libass existir, drawtext como fallback)
    // Para simplificar garantindo compatibilidade multiplataforma, vamos tentar gravar um drawtext simples 
    // ou depender de um ffmpeg completo (usaremos fallback pro ffmpeg nativo sem filtro se não suportar).
    const srtPath = gerarLegendasSrt(roteiro, duracaoTotal, outputPath);

    command
      .complexFilter(filterComplex)
      .outputOptions([
        '-map', '[outv]',
        '-map', `${numImagens}:a`,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '25', // Rápido + boa qualidade
        '-c:a', 'aac',
        '-b:a', '128k',
        '-shortest',
        '-pix_fmt', 'yuv420p',
        // Adiciona legenda vertical centralizada se o SO suportar libass
        `-vf`, `subtitles='${srtPath}':force_style='Fontname=Arial,FontSize=24,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Alignment=2'`, 
        '-movflags', '+faststart',
      ])
      .output(outputPath)
      .on('start', (cmdline) => {
        console.log(`[FFmpeg] Comando iniciado`);
      })
      .on('progress', (progress) => {
        if (progress.percent) {
          process.stdout.write(`\r[FFmpeg] Progresso: ${Math.round(progress.percent)}%`);
        }
      })
      .on('end', () => {
        console.log('\n[FFmpeg] ✅ Renderização concluída');
        // Limpa arquivo de legendas
        if(fs.existsSync(srtPath)) fs.unlinkSync(srtPath);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('\n[FFmpeg] ❌ Erro:', err.message);
        if(fs.existsSync(srtPath)) fs.unlinkSync(srtPath);
        reject(err);
      })
      .run();
  });
}

module.exports = { renderizarVideo };
