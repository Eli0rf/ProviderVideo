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
 * Busca todos os vídeos com status GERANDO_MIDIA.
 */
async function getVideosPendentes() {
  const [rows] = await getPool().execute(
    "SELECT * FROM videos_pipeline WHERE status = 'GERANDO_MIDIA'"
  );
  return rows;
}

/**
 * Atualiza vídeo com caminho do MP4 final e novo status.
 */
async function atualizarVideoFinalizado(idVideo, urlVideoFinal, novoStatus) {
  await getPool().execute(
    `UPDATE videos_pipeline
     SET url_video_final = ?, status = ?
     WHERE id_video = ?`,
    [urlVideoFinal, novoStatus, idVideo]
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
  atualizarVideoFinalizado,
  marcarFalha,
  inserirLogErro,
};
