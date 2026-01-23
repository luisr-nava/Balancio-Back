import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { envs } from './config';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const logger = new Logger('Balancio - Running');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'verbose'],
    bodyParser: false,
  });
  app.setGlobalPrefix('api/v1');
  app.use(
    '/api/v1/billing/webhook',
    bodyParser.raw({ type: 'application/json' }),
  );
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  
  const allowedOrigins = [
    envs.frontendUrl || 'http://localhost:3000',
    'http://localhost:3000',
    'http://localhost:5173', // Vite default
  ].filter((origin): origin is string => origin !== undefined);

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        logger.warn(`🚫 Origen bloqueado por CORS: ${origin}`);
        callback(new Error('No permitido por CORS'));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204,
    credentials: true,
    maxAge: 3600,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  try {
    logger.verbose(`Server running in port ${envs.port}`);
    await app.listen(envs.port);
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`❌ El puerto ${envs.port} ya está en uso!`);
    } else {
      logger.error('❌ Error inesperado:', error);
    }
    process.exit(1);
  }
}
bootstrap();
