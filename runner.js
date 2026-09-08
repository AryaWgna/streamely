const { spawn } = require('child_process');

// Gunakan npm.cmd untuk Windows, atau npm untuk Linux/Mac
const command = /^win/.test(process.platform) ? 'npm.cmd' : 'npm';

console.log("🚀 Memulai StreamEly Ecosystem lewat PM2 Node Runner...");

const child = spawn(command, ['start'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true,
  windowsHide: true // Sembunyikan jendela CMD bawaan Windows!
});

child.on('error', (err) => {
  console.error("Gagal menjalankan aplikasi:", err);
});

child.on('exit', (code) => {
  console.log(`Aplikasi berhenti dengan kode ${code}`);
  process.exit(code);
});
