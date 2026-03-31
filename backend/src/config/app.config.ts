export const appConfig = () => ({
  app: {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.PORT ?? 3000),
    corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    jwtSecret: process.env.JWT_SECRET ?? 'change-me',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
    passwordResetTtlMinutes: Number(
      process.env.PASSWORD_RESET_TTL_MINUTES ?? 30,
    ),
  },
  database: {
    url: process.env.DATABASE_URL ?? '',
  },
});
