import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
  // Database
  databaseUrl: z.string(),
  
  // Redis
  redisUrl: z.string().default('redis://localhost:6379'),
  
  // JWT
  jwtSecret: z.string(),
  jwtExpiresIn: z.string().default('7d'),
  
  // Server
  port: z.coerce.number().default(3001),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  
  // CORS
  corsOrigins: z.string().transform((val) => val.split(',')).default('http://localhost:5173'),
  
  // AWS S3
  awsRegion: z.string().default('ap-southeast-1'),
  awsAccessKeyId: z.string().optional(),
  awsSecretAccessKey: z.string().optional(),
  awsS3Bucket: z.string().default('xpress-driver-recruitment-docs'),
  
  // Integrations
  opstowerApiUrl: z.string().optional(),
  opstowerApiKey: z.string().optional(),
  marketingHubApiUrl: z.string().optional(),
  marketingHubApiKey: z.string().optional(),
  
  // Notifications
  twilioAccountSid: z.string().optional(),
  twilioAuthToken: z.string().optional(),
  twilioPhoneNumber: z.string().optional(),
  resendApiKey: z.string().optional(),
  fromEmail: z.string().default('recruitment@xpress.ph'),
  
  // Application
  candidatePortalUrl: z.string().default('https://apply.xpress.ph'),
});

export const appConfig = configSchema.parse({
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN,
  port: process.env.PORT,
  nodeEnv: process.env.NODE_ENV,
  corsOrigins: process.env.CORS_ORIGINS,
  awsRegion: process.env.AWS_REGION,
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  awsS3Bucket: process.env.AWS_S3_BUCKET,
  opstowerApiUrl: process.env.OPSTOWER_API_URL,
  opstowerApiKey: process.env.OPSTOWER_API_KEY,
  marketingHubApiUrl: process.env.MARKETING_HUB_API_URL,
  marketingHubApiKey: process.env.MARKETING_HUB_API_KEY,
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
  twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER,
  resendApiKey: process.env.RESEND_API_KEY,
  fromEmail: process.env.FROM_EMAIL,
  candidatePortalUrl: process.env.CANDIDATE_PORTAL_URL,
});
