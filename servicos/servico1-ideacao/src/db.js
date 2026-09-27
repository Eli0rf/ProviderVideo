const mysql = require('mysql2/promise');

let pool;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT, 10) || 3306,
      user: process.env.MYSQL_USER || 'pipeline_user',
      password: process.env.MYSQL_PASSWORD || 'pipeline_pass',
      database: process.env.MYSQL_DATABASE || 'pipeline_videos',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return pool;
}

/**
 * Busca vídeo pelo id.
 */
async function getVideo(idVideo) {
  const [rows] = await getPool().execute(
    'SELECT * FROM videos_pipeline WHERE id_video = ?',
    [idVideo]
  );
  return rows[0] || null;
}

/**
 * Busca todos os vídeos com status BUSCANDO_TEMA.
 */
async function getVideosPendentes() {
  const [rows] = await getPool().execute(
    "SELECT * FROM videos_pipeline WHERE status = 'BUSCANDO_TEMA'"
  );
  return rows;
}

/**
 * Busca inteligência do canal (padrões de sucesso / temas saturados).
 */
async function getInteligenciaCanal(idCanal) {
  const [rows] = await getPool().execute(
    'SELECT * FROM canal_inteligencia WHERE id_canal = ?',
    [idCanal]
  );
  return rows[0] || null;
}

/**
 * Busca canal pelo id.
 */
async function getCanal(idCanal) {
  const [rows] = await getPool().execute(
    'SELECT * FROM canais WHERE id_canal = ?',
    [idCanal]
  );
  return rows[0] || null;
}

/**
 * Busca template de tipo de vídeo.
 */
async function getTemplate(idTipo) {
  if (!idTipo) return null;
  const [rows] = await getPool().execute(
    'SELECT * FROM tipos_video_templates WHERE id_tipo = ?',
    [idTipo]
  );
  return rows[0] || null;
}

/**
 * Atualiza vídeo com dados gerados pela IA.
 */
async function atualizarVideoComRoteiro(idVideo, dados, novoStatus) {
  await getPool().execute(
    `UPDATE videos_pipeline
     SET tema = ?, titulo = ?, roteiro = ?, prompt_imagens = ?,
         humor_trilha = ?, hashtags = ?, variacoes_teste_ab = ?,
         status = ?
     WHERE id_video = ?`,
    [
      dados.tema,
      dados.titulo,
      dados.roteiro,
      JSON.stringify(dados.prompt_imagens),
      dados.humor_trilha,
      dados.hashtags,
      JSON.stringify(dados.variacoes_teste_ab),
      novoStatus,
      idVideo,
    ]
  );
}

/**
 * Marca vídeo como FALHA.
 */
async function marcarFalha(idVideo) {
  await getPool().execute(
    "UPDATE videos_pipeline SET status = 'FALHA' WHERE id_video = ?",
    [idVideo]
  );
}

/**
 * Insere log de erro.
 */
async function inserirLogErro(idVideo, codigoErro, detalhesTecnicos) {
  await getPool().execute(
    'INSERT INTO logs_erros (id_video, codigo_erro, detalhes_tecnicos) VALUES (?, ?, ?)',
    [idVideo, codigoErro, detalhesTecnicos]
  );
}

module.exports = {
  getPool,
  getVideo,
  getVideosPendentes,
  getInteligenciaCanal,
  getCanal,
  getTemplate,
  atualizarVideoComRoteiro,
  marcarFalha,
  inserirLogErro,
};
