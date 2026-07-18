import os from 'os';

function getLocalNetworkIPs() {
  const ips = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4') {
        ips.push(iface.address);
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
