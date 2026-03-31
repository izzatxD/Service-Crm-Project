type EnvInput = Record<string, string | undefined>;

export function validateEnv(config: EnvInput) {
  const required = ['DATABASE_URL', 'JWT_SECRET'];

  for (const key of required) {
    if (!config[key] || config[key]?.trim() === '') {
      throw new Error(`Environment variable ${key} is required.`);
    }
  }

  return config;
}
