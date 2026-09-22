module.exports = {
  apps: [
    {
      name: "StreamEly-Backend",
      script: "bun",
      args: "run src/index.ts",
      cwd: "./backend",
      watch: false,
      interpreter: "none"
    },
    {
      name: "StreamEly-Frontend",
      script: "node",
      args: "./node_modules/vite/bin/vite.js preview --port 5173 --host",
      cwd: "./frontend",
      watch: false
    },
    {
      name: "StreamEly-Proxy",
      script: "bun",
      args: "run proxy.ts",
      cwd: "./",
      watch: false,
      interpreter: "none"
    }
  ]
};
