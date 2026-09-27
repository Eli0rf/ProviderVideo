require('dotenv').config();

const { Worker, Queue } = require('bullmq');
const IORedis = require('ioredis');
const { processarMidia } = require('./worker');
const db = require('./db');

const QUEUE_NAME = 'midia';

const redisConnection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  maxRetriesPerRequest: null,
});

// Fila para adicionar jobs externamente
const filaMidia = new Queue(QUEUE_NAME, { connection: redisConnection });

// Worker que consome jobs da fila
const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    return await processarMidia(job);
  },
  {
    connection: redisConnection,
    concurrency: 1, // FFmpeg é CPU-intensivo, 1 por vez
  }
);

worker.on('completed', (job, result) => {
  console.log(`[Fila] ✅ Job ${job.id} concluído:`, result);
});

worker.on('failed', (job, err) => {
  console.error(`[Fila] ❌ Job ${job.id} falhou:`, err.message);
});

worker.on('error', (err) => {
  console.error('[Fila] Erro no worker:', err);
});

/**
 * Scan inicial: busca vídeos pendentes no banco e enfileira.
 */
async function enfileirarPendentes() {
  try {
    const pendentes = await db.getVideosPendentes();
    console.log(`[Boot] Encontrados ${pendentes.length} vídeos pendentes (GERANDO_MIDIA)`);

    for (const video of pendentes) {
      await filaMidia.add('processar-midia', {
        idVideo: video.id_video,
      }, {
        jobId: `midia-${video.id_video}`,
        attempts: 1, // retries gerenciados internamente no worker
      });
      console.log(`[Boot] Enfileirado vídeo id=${video.id_video}`);
    }
  } catch (err) {
    console.error('[Boot] Erro ao enfileirar pendentes:', err.message);
  }
}

async function main() {
  console.log('========================================');
  console.log(' Serviço 2 - Motor de Mídia (FFmpeg)');
  console.log('========================================');
  console.log(`[Config] Redis: ${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`);
  console.log(`[Config] MySQL: ${process.env.MYSQL_HOST || 'localhost'}:${process.env.MYSQL_PORT || 3306}/${process.env.MYSQL_DATABASE || 'pipeline_videos'}`);
  console.log(`[Config] Fila: ${QUEUE_NAME} (concurrency: 1)`);
  console.log(`[Config] Output: ${process.env.OUTPUT_DIR || './output'}`);
  console.log('');

  await enfileirarPendentes();

  console.log('[Worker] Aguardando jobs na fila...');
}

main().catch((err) => {
  console.error('[Fatal]', err);
  process.exit(1);
});

// Graceful shutdown
async function shutdown() {
  console.log('\n[Shutdown] Encerrando worker...');
  await worker.close();
  await filaMidia.close();
  await redisConnection.quit();
  const pool = db.getPool();
  await pool.end();
  console.log('[Shutdown] Encerrado.');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = { filaMidia };
