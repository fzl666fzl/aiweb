type RequiredEnv =
  | "AI_BASE_URL"
  | "AI_API_KEY"
  | "AI_MODEL"
  | "SUPABASE_URL"
  | "SUPABASE_SERVICE_ROLE_KEY"
  | "APP_ACCESS_SECRET";

export function getEnv(name: RequiredEnv) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}
