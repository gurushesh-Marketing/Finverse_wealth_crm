const net = require('net');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const LISTEN_HOST = '127.0.0.1';
// 5433 is owned by WSL's unreliable localhost relay on this workstation.
// Keep the project bridge on a distinct host port; PostgreSQL still listens on 5433 inside WSL.
const LISTEN_PORT = Number.parseInt(process.env.PG_PROXY_LISTEN_PORT || '15433', 10);
const TARGET_PORT = 5433;
const WSL_EXE = 'C:\\Windows\\System32\\wsl.exe';
const WSL_DISTRO = 'Ubuntu';

let cachedTargetIp = null;
let resolvingTargetIp = null;

async function resolveTargetIp({ force = false } = {}) {
  if (!force && cachedTargetIp) return cachedTargetIp;
  if (!force && resolvingTargetIp) return resolvingTargetIp;

  resolvingTargetIp = execFileAsync(
    WSL_EXE,
    ['-d', WSL_DISTRO, '-e', 'hostname', '-I'],
    { windowsHide: true, timeout: 5000, encoding: 'utf8' },
  ).then(({ stdout }) => {
    const address = stdout.trim().split(/\s+/).find(Boolean);
    if (!address) throw new Error('WSL returned no network address.');
    cachedTargetIp = address;
    return address;
  }).finally(() => {
    resolvingTargetIp = null;
  });

  return resolvingTargetIp;
}

async function connectUpstream(client, allowRetry = true) {
  if (client.destroyed) return;

  let targetIp;
  try {
    targetIp = await resolveTargetIp({ force: !cachedTargetIp });
  } catch (error) {
    console.error('[pg-proxy] Unable to resolve WSL address:', error.message);
    client.destroy();
    return;
  }

  const upstream = net.connect({ host: targetIp, port: TARGET_PORT });
  let connected = false;

  upstream.once('connect', () => {
    connected = true;
    client.pipe(upstream);
    upstream.pipe(client);
  });

  upstream.once('error', async (error) => {
    upstream.destroy();
    if (!connected && allowRetry && !client.destroyed) {
      cachedTargetIp = null;
      console.warn('[pg-proxy] Upstream changed; resolving WSL address and retrying once.');
      await connectUpstream(client, false);
      return;
    }
    console.error('[pg-proxy] Upstream connection failed:', error.message);
    client.destroy();
  });

  client.once('error', (error) => {
    console.error('[pg-proxy] Client socket error:', error.message);
    upstream.destroy();
  });
  client.once('close', () => upstream.destroy());
  upstream.once('close', () => {
    if (connected) client.destroy();
  });
}

const server = net.createServer((client) => {
  void connectUpstream(client);
});

server.on('error', (error) => {
  console.error('[pg-proxy] Server error:', error.message);
  process.exitCode = 1;
});

server.listen(LISTEN_PORT, LISTEN_HOST, async () => {
  try {
    const targetIp = await resolveTargetIp({ force: true });
    console.log(`[pg-proxy] Forwarding ${LISTEN_HOST}:${LISTEN_PORT} -> ${targetIp}:${TARGET_PORT}`);
  } catch (error) {
    console.error('[pg-proxy] Started, but WSL address resolution failed:', error.message);
  }
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
