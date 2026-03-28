import { Logger } from '@nestjs/common';
import 'dotenv/config';
import * as joi from 'joi';
interface EnvVars {
  PORT: number;
  DB_PORT: number;
  DB_PASSWORD: string;
  DB_NAME: string;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
  FRONTEND_URL?: string;
  NODE_ENV?: string;
  // Stripe — all three are required for billing to work correctly.
  // Missing any of these causes invoice.paid to silently skip plan updates.
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_BASIC?: string;
  STRIPE_PRICE_PRO?: string;
  MP_WEBHOOK_SECRET?: string;
}

const log = new Logger('EnvVars - ');
const envVarsSchema = joi
  .object({
    PORT: joi.number().port().required(),
    DB_PORT: joi.number().port().required(),
    DB_PASSWORD: joi.string().min(8).required(),
    DB_NAME: joi.string().min(3).max(63).required(),
    JWT_SECRET: joi.string().min(32).required().messages({
      'string.min':
        'JWT_SECRET debe tener al menos 32 caracteres para ser seguro',
    }),
    JWT_REFRESH_SECRET: joi.string().min(32).required().messages({
      'string.min':
        'JWT_REFRESH_SECRET debe tener al menos 32 caracteres para ser seguro',
    }),
    NODE_ENV: joi.string().valid('development', 'production', 'test').optional(),
    CLOUDINARY_CLOUD_NAME: joi.string().min(3).max(63).required(),
    CLOUDINARY_API_KEY: joi.string().min(3).max(63).required(),
    CLOUDINARY_API_SECRET: joi.string().min(3).max(63).required(),
    FRONTEND_URL: joi.string().uri().optional(),
    STRIPE_SECRET_KEY: joi.string().optional(),
    STRIPE_WEBHOOK_SECRET: joi.string().optional(),
    STRIPE_PRICE_BASIC: joi.string().optional(),
    STRIPE_PRICE_PRO: joi.string().optional(),
    MP_WEBHOOK_SECRET: joi.string().optional(),
  })
  .unknown(true);

const { error, value } = envVarsSchema.validate(process.env);
if (error) {
  log.error(`Config validation error: ${error.message}`);
  throw new Error(`Config validation error: ${error.message}`);
}

const envVars: EnvVars = value;

export const envs = {
  port: envVars.PORT,
  dbPort: envVars.DB_PORT,
  dbPassword: envVars.DB_PASSWORD,
  dbName: envVars.DB_NAME,
  jwtSecret: envVars.JWT_SECRET,
  jwtRefreshSecret: envVars.JWT_REFRESH_SECRET,
  nodeEnv: envVars.NODE_ENV ?? 'development',
  CLOUDINARY_CLOUD_NAME: envVars.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: envVars.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: envVars.CLOUDINARY_API_SECRET,
  frontendUrl: envVars.FRONTEND_URL,
  stripeSecretKey: envVars.STRIPE_SECRET_KEY,
  stripeWebhookSecret: envVars.STRIPE_WEBHOOK_SECRET,
  stripePriceBasic: envVars.STRIPE_PRICE_BASIC,
  stripePricePro: envVars.STRIPE_PRICE_PRO,
  mpWebhookSecret: envVars.MP_WEBHOOK_SECRET,
};
