const { spawn } = require('child_process');

const command = /^win/.test(process.platform) ? 'npm.cmd' : 'npm';

console.log("Starting StreamEly via PM2 runner...");

const child = spawn(command, ['start'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true,
  windowsHide: true
});

child.on('error', (err) => {
  console.error("Failed to start application:", err);
});

child.on('exit', (code) => {
  console.log(`Application exited with code ${code}`);
  process.exit(code);
});
