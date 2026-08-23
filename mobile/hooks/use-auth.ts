import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, EMULATOR_API_BASE_URL, HEALTH_WORKER_CREDENTIALS } from '@/constants/api';

const TOKEN_KEY = '@oralcare_auth_token';
const ACTIVE_HOST_KEY = '@oralcare_active_host';

let _cachedToken: string | null = null;
let _activeBaseUrl: string = API_BASE_URL;

export function getActiveBaseUrl(): string {
  return _activeBaseUrl;
}

export async function setCustomHost(hostUrl: string): Promise<boolean> {
  const cleanUrl = hostUrl.trim().replace(/\/+$/, '');
  try {
    const token = await tryLoginAtHost(cleanUrl);
    if (token) {
      _cachedToken = token;
      _activeBaseUrl = cleanUrl;
      await AsyncStorage.setItem(TOKEN_KEY, token);
      await AsyncStorage.setItem(ACTIVE_HOST_KEY, cleanUrl);
      return true;
    }
  } catch (err) {
    console.error('Custom host connection test failed:', err);
  }
  return false;
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

async function tryLoginAtHost(baseUrl: string): Promise<string | null> {
  try {
    const health = await fetchWithTimeout(`${baseUrl}/health`, { method: 'GET' }, 8000);
    if (!health.ok) return null;

    const loginRes = await fetchWithTimeout(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        username: HEALTH_WORKER_CREDENTIALS.username,
        password: HEALTH_WORKER_CREDENTIALS.password,
      }).toString(),
    }, 8000);

    if (loginRes.ok) {
      const data = await loginRes.json();
      _activeBaseUrl = baseUrl;
      await AsyncStorage.setItem(ACTIVE_HOST_KEY, baseUrl);
      return data.access_token;
    }

    if (loginRes.status === 401) {
      const regRes = await fetchWithTimeout(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: HEALTH_WORKER_CREDENTIALS.username,
          password: HEALTH_WORKER_CREDENTIALS.password,
          role: 'health_worker',
          full_name: 'OralCare Field Worker',
        }),
      }, 8000);

      if (regRes.ok) {
        const retry = await fetchWithTimeout(`${baseUrl}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            username: HEALTH_WORKER_CREDENTIALS.username,
            password: HEALTH_WORKER_CREDENTIALS.password,
          }).toString(),
        }, 8000);
        if (retry.ok) {
          const data = await retry.json();
          _activeBaseUrl = baseUrl;
          await AsyncStorage.setItem(ACTIVE_HOST_KEY, baseUrl);
          return data.access_token;
        }
      }
    }
  } catch {
    // Host unreachable
  }
  return null;
}

async function getOrFetchToken(): Promise<string> {
  const savedHost = await AsyncStorage.getItem(ACTIVE_HOST_KEY).catch(() => null);

  const candidateHosts = [
    savedHost,
    API_BASE_URL,
    EMULATOR_API_BASE_URL,
    'http://127.0.0.1:8000',
    'http://localhost:8000',
  ].filter((h): h is string => Boolean(h));

  const uniqueHosts = Array.from(new Set(candidateHosts));

  for (const host of uniqueHosts) {
    const token = await tryLoginAtHost(host);
    if (token) {
      _cachedToken = token;
      _activeBaseUrl = host;
      await AsyncStorage.setItem(TOKEN_KEY, token);
      await AsyncStorage.setItem(ACTIVE_HOST_KEY, host);
      return token;
    }
  }

  // If still not reachable (offline mode)
  if (!_cachedToken) {
    _cachedToken = `offline_token_${Date.now()}`;
  }
  return _cachedToken;
}

export { getOrFetchToken };
