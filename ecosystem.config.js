/**
 * AlphaMind Lite - PM2 Ecosystem Configuration
 * Process management for production deployment
 *
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 start ecosystem.config.js --env production
 *   pm2 reload ecosystem.config.js   # zero-downtime reload
 */

module.exports = {
  apps: [
    {
      name: 'alphamind-server',
      script: 'scripts/server.js',
      instances: process.env.PM2_INSTANCES || 2,  // use fixed count inside Docker containers
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 5000,

      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss.SSS',
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      merge_logs: true,
      log_type: 'json',

      // Environment
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },

      // Graceful shutdown
      kill_timeout: 10000,
      listen_timeout: 8000,
      shutdown_with_message: true,

      // Source map support
      source_map_support: true,
    },

    // Price monitoring worker (single instance)
    {
      name: 'alphamind-monitor',
      script: 'scripts/price-monitor-worker.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '128M',
      cron_restart: '0 */6 * * *', // restart every 6 hours

      log_date_format: 'YYYY-MM-DD HH:mm:ss.SSS',
      error_file: 'logs/monitor-error.log',
      out_file: 'logs/monitor-out.log',
      merge_logs: true,

      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
