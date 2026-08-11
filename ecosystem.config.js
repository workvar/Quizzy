module.exports = {
  apps: [
    {
      name: "Quizzy",
      script: "./server.js",

      env_development: {
        NODE_ENV: "development",
        PORT: 5151,
      },

      env_production: {
        NODE_ENV: "production",
        PORT: 5151,
      },

      env_file: ".env",

      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",

      error_file: "./logs/quizzy-error.log",
      out_file: "./logs/quizzy-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
    },
  ],
};
