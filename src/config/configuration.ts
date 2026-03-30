export default () => ({
  projectName: process.env.PROJECT_NAME || 'AI CRM',
  version: process.env.VERSION || '1.0.0',
  apiV1Str: process.env.API_V1_STR || '/api/v1',
  mongodb: {
    url: process.env.MONGODB_URL,
    dbName: process.env.DATABASE_NAME || 'crm_db',
  },
  whatsapp: {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    apiVersion: process.env.WHATSAPP_API_VERSION || 'v21.0',
  },
  auth: {
    secretKey: process.env.SECRET_KEY,
    algorithm: process.env.ALGORITHM || 'HS256',
    expiresIn: parseInt(process.env.ACCESS_TOKEN_EXPIRE_MINUTES || '10080', 10) * 60, // in seconds
  },
  gcp: {
    credentialsJson: process.env.GCP_CREDENTIALS_JSON,
    bucketName: process.env.GCP_STORAGE_BUCKET || 'ai-crm-recordings',
  },
  ai: {
    baseUrl: process.env.AI_BASE_URL || 'http://localhost:8000',
    costPer1KTokens: 0.2, // Default price in INR for token consumption tracking
  },
});
