import os from 'os';

function getLocalNetworkIPs() {
  const ips = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4') {
        ips.push(iface.address);
        // Also whitelist the entire subnet range of this IP to handle local DHCP changes dynamically
        const parts = iface.address.split('.');
        if (parts.length === 4) {
          const base = `${parts[0]}.${parts[1]}.${parts[2]}`;
          for (let i = 1; i <= 254; i++) {
            ips.push(`${base}.${i}`);
          }
        }
      }
    }
  }
  return ips;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
    ...getLocalNetworkIPs().map(ip => `${ip}:3000`),
    ...getLocalNetworkIPs(),
  ],
};

export default nextConfig;
