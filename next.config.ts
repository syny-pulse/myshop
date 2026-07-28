import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * Leave `ws` out of the server bundle and require it at runtime instead.
   *
   * `ws` optionally requires the native `bufferutil` addon, guarded by a
   * try/catch. Bundled, that require resolves to a stub rather than throwing,
   * so `ws` believes the native masker exists and calls `bufferutil.mask()`,
   * which is not a function. It surfaces on a timer as an uncaught exception —
   * a ping frame, outside any request — and takes the whole function down.
   *
   * Unbundled, the require genuinely fails and `ws` uses its JS fallback.
   * We need `ws` at all because db/index.ts uses Neon's WebSocket pool driver.
   */
  serverExternalPackages: ['ws'],
};

export default nextConfig;
