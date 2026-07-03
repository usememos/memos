export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  ASSETS: Fetcher;

  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
  ADMIN_EMAILS: string;
  INSTANCE_URL: string;
  DEV_USER_EMAIL: string;

  OPENAI_API_KEY?: string;
  GEMINI_API_KEY?: string;
  RESEND_API_KEY?: string;
}
