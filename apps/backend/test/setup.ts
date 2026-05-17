import process from 'node:process';

process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://vben:vben_dev_pwd@localhost:5432/shop_bookkeeping_test?schema=public';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.CORS_ORIGIN = 'http://localhost';
