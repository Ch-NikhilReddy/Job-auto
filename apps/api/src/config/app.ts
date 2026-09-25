export const appConfig = {
  port: Number(process.env.APP_PORT ?? 4000),
  env: process.env.APP_ENV ?? 'development',
};
