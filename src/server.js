// Servidor Fastify — sirve el frontend estático de public/ + API JSON.
// Sin bundler: el frontend va tal cual. Único "build" es `prisma generate`.
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { prisma } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'development' ? 'info' : 'warn',
  },
});

// Convierte BigInt (id) a string para que JSON.stringify no falle.
function serializeMessage(m) {
  return {
    id: m.id.toString(),
    name: m.name,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
  };
}

// Sirve los estáticos del frontend (index.html, styles.css, app.js).
await app.register(fastifyStatic, {
  root: join(__dirname, '..', 'public'),
  prefix: '/',
});

// Health check para Coolify.
app.get('/health', async () => ({ status: 'ok' }));

// Últimos 50 mensajes, más recientes primero.
app.get('/api/messages', async () => {
  const messages = await prisma.message.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return messages.map(serializeMessage);
});

// Crea un mensaje. Valida name 1–50 y body 1–280.
app.post('/api/messages', async (request, reply) => {
  const payload = request.body ?? {};
  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  const body = typeof payload.body === 'string' ? payload.body.trim() : '';

  if (name.length < 1 || name.length > 50) {
    return reply.code(400).send({ error: 'El nombre debe tener entre 1 y 50 caracteres.' });
  }
  if (body.length < 1 || body.length > 280) {
    return reply.code(400).send({ error: 'El mensaje debe tener entre 1 y 280 caracteres.' });
  }

  const created = await prisma.message.create({ data: { name, body } });
  return reply.code(201).send(serializeMessage(created));
});

// Manejador global: registra el error y responde 500, pero no tumba el proceso.
app.setErrorHandler((error, request, reply) => {
  request.log.error(error);
  reply.code(error.statusCode ?? 500).send({ error: 'Error interno del servidor.' });
});

// Red de seguridad: que una promesa o excepción suelta no mate el contenedor.
process.on('unhandledRejection', (reason) => {
  app.log.error({ reason }, 'unhandledRejection');
});
process.on('uncaughtException', (err) => {
  app.log.error(err, 'uncaughtException');
});

try {
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`Mural escuchando en http://${HOST}:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
