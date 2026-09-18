import { config } from './config';
import { app } from './app';
import { logger } from './utils/logger';
import { prisma } from './utils/prisma';

async function startServer() {
  try {
    await prisma.$connect();
    logger.info('Database connected');

    const server = app.listen(config.API_PORT, () => {
      logger.info(`Server running on port ${config.API_PORT} in ${config.NODE_ENV} mode`);
    });

    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully`);
      server.close(async () => {
        await prisma.$disconnect();
        logger.info('Database disconnected');
        process.exit(0);
      });

      setTimeout(() => {
        logger.error('Forced shutdown');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (err) {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  }
}

startServer();