/**
 * PM2 process file for Quizzy (custom Next.js + Socket.io server).
 *
 * Usage:
 *   pnpm build
 *   pm2 start ecosystem.config.js --env development
 *   pm2 start ecosystem.config.js --env staging
 *   pm2 start ecosystem.config.js --env production
 *   pm2 reload ecosystem.config.js --env production
 *
 * Secrets (DATABASE_URL, SESSION_SECRET, …) load from `.env` /
 * `.env.production` via server.js → @next/env. This file only sets
 * process-level NODE_ENV / PORT / HOSTNAME per environment.
 *
 * Keep instances at 1 (fork). Socket.io state is in-memory; clustering
 * needs a Redis adapter + sticky sessions before raising instances.
 */
module.exports = {
  apps: [
    {
      name: 'quizzy',
      script: './server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '512M',
      kill_timeout: 5000,
      listen_timeout: 10000,
      time: true,
      merge_logs: true,
      error_file: './logs/quizzy-error.log',
      out_file: './logs/quizzy-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Default when started without --env
      env: {
        NODE_ENV: 'development',
        PORT: 5151,
        HOSTNAME: 'localhost',
      },

      env_development: {
        NODE_ENV: 'development',
        PORT: 5151,
        HOSTNAME: 'localhost',
      },

      env_staging: {
        NODE_ENV: 'production',
        PORT: 5151,
        HOSTNAME: '0.0.0.0',
      },

      env_production: {
        NODE_ENV: 'production',
        PORT: 5151,
        HOSTNAME: '0.0.0.0',
      },
    },
  ],
};
