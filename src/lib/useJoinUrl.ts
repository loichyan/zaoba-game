import { useEffect, useState } from 'react';

let cachedLanPromise: Promise<string | null> | null = null;

function isLoopbackHost(hostname: string): boolean {
  return ['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'].includes(hostname);
}

function fetchLanAddress(): Promise<string | null> {
  if (!cachedLanPromise) {
    cachedLanPromise = fetch('/api/network')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { addresses?: string[] } | null) => {
        if (!data?.addresses?.length) return null;
        return data.addresses.find((ip) => ip.startsWith('192.168.')) || data.addresses[0];
      })
      .catch(() => null);
  }
  return cachedLanPromise;
}

/**
 * Builds the student join URL for a room, resolving LAN IP when opened via localhost.
 */
export function useJoinUrl(code: string) {
  const [lan, setLan] = useState<string | null>(null);
  const isLocal = isLoopbackHost(window.location.hostname);
  const port = window.location.port ? `:${window.location.port}` : '';
  const qrOrigin = isLocal && lan ? `${window.location.protocol}//${lan}${port}` : window.location.origin;
  const joinUrl = `${qrOrigin}/play?room=${code}`;
  const displayUrl = joinUrl.replace(/^https?:\/\//, '');

  useEffect(() => {
    if (!isLocal) return undefined;
    let alive = true;
    fetchLanAddress().then((address) => {
      if (alive && address) setLan(address);
    });
    return () => {
      alive = false;
    };
  }, [isLocal]);

  return { joinUrl, displayUrl, isLocal, lan };
}
