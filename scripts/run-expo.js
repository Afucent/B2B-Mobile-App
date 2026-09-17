const { spawn } = require('child_process');
const loadDotenv = require('./load-dotenv');

loadDotenv();

const port = process.env.EXPO_PORT || '8081';
const extra = process.argv.slice(2);
const child = spawn('npx', ['expo', 'start', '--port', port, ...extra], {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
