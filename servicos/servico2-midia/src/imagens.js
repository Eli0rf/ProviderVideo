const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

/**
 * Baixa imagens placeholder do Picsum Photos para simular geração de imagens.
 *
 * @param {string[]} prompts - Array de prompts de imagem (usados apenas para log)
 * @param {string} outputDir - Diretório para salvar as imagens
 * @returns {Promise<string[]>} Array de caminhos das imagens salvas
 */
async function baixarImagensMock(prompts, outputDir) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const caminhos = [];

  for (let i = 0; i < prompts.length; i++) {
    const nomeArquivo = `cena${i + 1}.jpg`;
    const caminhoFinal = path.join(outputDir, nomeArquivo);
    // Picsum: cada request com seed diferente gera imagem diferente
    const url = `https://picsum.photos/seed/${Date.now()}-${i}/1280/720`;

    console.log(`[Imagens] Baixando cena${i + 1} (prompt: "${prompts[i].substring(0, 50)}...")`);

    await baixarArquivo(url, caminhoFinal);
    caminhos.push(caminhoFinal);

    console.log(`[Imagens] ✅ Salvo: ${caminhoFinal}`);
  }

  return caminhos;
}

/**
 * Baixa arquivo de URL com suporte a redirect (Picsum redireciona 302).
 */
function baixarArquivo(url, destino, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      return reject(new Error('Máximo de redirects atingido'));
    }

    const client = url.startsWith('https') ? https : http;

    client.get(url, (res) => {
      // Segue redirect
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return baixarArquivo(res.headers.location, destino, maxRedirects - 1)
          .then(resolve)
          .catch(reject);
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} ao baixar ${url}`));
      }

      const fileStream = fs.createWriteStream(destino);
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });
      fileStream.on('error', (err) => {
        fs.unlinkSync(destino);
        reject(err);
      });
    }).on('error', reject);
  });
}

module.exports = { baixarImagensMock };
