// PrismaClient compartido (singleton) para toda la app.
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

// Cierre limpio para no dejar conexiones colgando al apagar el contenedor.
async function disconnect() {
  await prisma.$disconnect();
}

process.on('SIGINT', disconnect);
process.on('SIGTERM', disconnect);
