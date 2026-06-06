import packageJson from "../../../../package.json";

type HealthChecks = {
  aiBaseUrlConfigured: boolean;
  aiApiKeyConfigured: boolean;
  aiModelConfigured: boolean;
  supabaseUrlConfigured: boolean;
  supabaseServiceRoleKeyConfigured: boolean;
  appAccessSecretConfigured: boolean;
  membershipCodeSecretConfigured: boolean;
};

const REQUIRED_CHECKS: Array<keyof HealthChecks> = [
  "aiBaseUrlConfigured",
  "aiApiKeyConfigured",
  "aiModelConfigured",
  "supabaseUrlConfigured",
  "supabaseServiceRoleKeyConfigured",
  "appAccessSecretConfigured",
];

export const dynamic = "force-dynamic";

function hasEnv(name: string) {
  return Boolean(process.env[name]?.trim());
}

export async function GET() {
  const checks: HealthChecks = {
    aiBaseUrlConfigured: hasEnv("AI_BASE_URL"),
    aiApiKeyConfigured: hasEnv("AI_API_KEY"),
    aiModelConfigured: hasEnv("AI_MODEL"),
    supabaseUrlConfigured: hasEnv("SUPABASE_URL"),
    supabaseServiceRoleKeyConfigured: hasEnv("SUPABASE_SERVICE_ROLE_KEY"),
    appAccessSecretConfigured: hasEnv("APP_ACCESS_SECRET"),
    membershipCodeSecretConfigured: hasEnv("MEMBERSHIP_CODE_SECRET"),
  };
  const ok = REQUIRED_CHECKS.every((name) => checks[name]);

  return Response.json(
    {
      ok,
      service: "aiweb",
      version: packageJson.version,
      environment: process.env.NODE_ENV ?? "development",
      checks,
    },
    { headers: { "Cache-Control": "no-store" }, status: ok ? 200 : 503 },
  );
}
