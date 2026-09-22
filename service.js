const { spawn } = require('child_process');
const path = require('path');

const ROOT = __dirname;
const isWin = process.platform === 'win32';

function startProcess(name, cmd, args, cwd) {
  const proc = spawn(cmd, args, {
    cwd: cwd,
    stdio: 'pipe',
    shell: isWin,
    windowsHide: true
  });

  proc.stdout.on('data', (data) => {
    data.toString().split('\n').filter(l => l.trim()).forEach(line => {
      console.log(`[${name}] ${line}`);
    });
  });

  proc.stderr.on('data', (data) => {
    data.toString().split('\n').filter(l => l.trim()).forEach(line => {
      console.error(`[${name}] ${line}`);
    });
  });

  proc.on('exit', (code) => {
    console.error(`[${name}] Process exited with code ${code}. Restarting in 3s...`);
    setTimeout(() => startProcess(name, cmd, args, cwd), 3000);
  });

  proc.on('error', (err) => {
    console.error(`[${name}] Failed to start: ${err.message}. Retrying in 3s...`);
    setTimeout(() => startProcess(name, cmd, args, cwd), 3000);
  });

  console.log(`[${name}] Started (PID: ${proc.pid})`);
  return proc;
}

console.log('=== StreamEly Service Starting ===');
console.log(`Root: ${ROOT}`);
console.log(`Time: ${new Date().toLocaleString()}`);
console.log('');

// Backend: bun run src/index.ts
startProcess('BACKEND', 'bun', ['run', 'src/index.ts'], path.join(ROOT, 'backend'));

// Frontend: vite preview --port 5173 --host
startProcess('FRONTEND', 'node', [
  path.join(ROOT, 'frontend', 'node_modules', 'vite', 'bin', 'vite.js'),
  'preview', '--port', '5173', '--host'
], path.join(ROOT, 'frontend'));

// Proxy: bun run proxy.ts
startProcess('PROXY', 'bun', ['run', 'proxy.ts'], ROOT);

// Keep alive
process.on('SIGINT', () => {
  console.log('\n[SERVICE] Shutting down...');
  process.exit(0);
});
