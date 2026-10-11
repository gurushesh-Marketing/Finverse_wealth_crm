const net = require('net');
const { execSync } = require('child_process');

let wslIp = '127.0.0.1';
try {
  wslIp = execSync('wsl -d Ubuntu -e hostname -I', { encoding: 'utf8' }).trim().split(/\s+/)[0];
} catch (e) {
  console.error('Failed to get WSL IP:', e.message);
}

console.log(`[pg-proxy] Forwarding 127.0.0.1:5433 -> ${wslIp}:5433`);

const server = net.createServer((clientSocket) => {
  const pgSocket = net.connect(5433, wslIp);
  clientSocket.pipe(pgSocket);
  pgSocket.pipe(clientSocket);

  clientSocket.on('error', () => {
    pgSocket.destroy();
  });
  pgSocket.on('error', () => {
    clientSocket.destroy();
  });
});

server.listen(5433, '0.0.0.0', () => {
  console.log('[pg-proxy] Listening on 0.0.0.0:5433');
});
