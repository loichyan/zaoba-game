export interface CreatedRoom {
  code: string;
  pin: string;
  hostToken: string;
}

export interface JoinedRoom {
  playerId: string;
  token: string;
  code: string;
  name: string;
  activeFrom: number;
  reclaimed?: boolean;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  offlineName?: string;

  constructor(message: string, status: number, code?: string, offlineName?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.offlineName = offlineName;
  }
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  const res = await fetch(url, { ...options, headers });
  const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string; offlineName?: string };
  if (!res.ok) throw new ApiError(data.error || '网络不给力，再试一次', res.status, data.code, data.offlineName);
  return data as T;
}

export function createRoom(pin?: string): Promise<CreatedRoom> {
  return request<CreatedRoom>('/api/rooms', {
    method: 'POST',
    body: JSON.stringify({ ...(pin ? { pin } : {}) }),
  });
}

export function hostLogin(code: string, pin: string): Promise<{ hostToken: string; pin: string; code: string }> {
  return request(`/api/rooms/${encodeURIComponent(code)}/host-login`, {
    method: 'POST',
    body: JSON.stringify({ pin }),
  });
}

export function joinRoom(code: string, name: string, reclaim = false): Promise<JoinedRoom> {
  return request<JoinedRoom>(`/api/rooms/${encodeURIComponent(code)}/join`, {
    method: 'POST',
    body: JSON.stringify(reclaim ? { name, reclaim: true } : { name }),
  });
}
