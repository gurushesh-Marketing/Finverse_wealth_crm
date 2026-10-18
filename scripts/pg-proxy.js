const net = require('net');
const { execSync } = require('child_process');

function getWslIp() {
  try {
    const out = execSync('wsl -d Ubuntu -e hostname -I', { encoding: 'utf8', timeout: 3000 });
    return out.trim().split(/\s+/)[0];
  } catch (err) {
    return '172.21.161.117';
  }
}

const targetIp = getWslIp();
console.log(`[pg-proxy] Target WSL IP: ${targetIp}`);

const server = net.createServer((client) => {
  const upstream = net.connect({ host: targetIp, port: 5433 });
  client.pipe(upstream);
  upstream.pipe(client);

  client.on('error', (err) => {
    console.error('[pg-proxy] client socket error:', err.message);
    upstream.destroy();
  });
  upstream.on('error', (err) => {
    console.error('[pg-proxy] upstream pg socket error:', err.message);
    client.destroy();
  });
  client.on('close', () => upstream.destroy());
  upstream.on('close', () => client.destroy());
});

server.listen(5433, '127.0.0.1', () => {
  console.log(`[pg-proxy] Forwarding 127.0.0.1:5433 -> ${targetIp}:5433`);
});
