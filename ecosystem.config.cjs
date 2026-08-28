module.exports = {
  apps: [
    {
      name: "apm-self-service",
      cwd: __dirname,
      script: ".output/server/index.mjs",
      interpreter: "node",
      node_args: ["--env-file=.env"],
      env: {
        NODE_ENV: "production",
        HOST: "0.0.0.0",
        PORT: "3886",
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      time: true,
    },
  ],
};
