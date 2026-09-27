export const appConfig = {
  // Render/most PaaS inject PORT; fall back to APP_PORT, then 4000
  port: Number(process.env.PORT ?? process.env.APP_PORT ?? 4000),
  env: process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development',
};
