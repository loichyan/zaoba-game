const prefix = 'zaoba';

export function hostKey(code: string): string {
  return `${prefix}:host:${code}`;
}

export function playerKey(code: string): string {
  return `${prefix}:player:${code}`;
}

export function read(key: string): string {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

export function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function playerName(): string {
  return read(`${prefix}:name`);
}

export function savePlayerName(name: string): void {
  write(`${prefix}:name`, name);
}
