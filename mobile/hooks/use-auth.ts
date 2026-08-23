/**
 * useAuth — resilient multi-host auth hook.
 *
 * Tries Wi-Fi LAN IP (for real devices) and 10.0.2.2 (for emulator) with fast timeout.
 * If server is unreachable (offline mode), falls back smoothly to offline token.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { API_BASE_URL, EMULATOR_API_BASE_URL, HEALTH_WORKER_CREDENTIALS } from '@/constants/api';

const TOKEN_KEY = '@oralcare_auth_token';
const ACTIVE_HOST_KEY = '@oralcare_active_host';

let _cachedToken: string | null = null;
let _activeBaseUrl: string = API_BASE_URL;

export function getActiveBaseUrl(): string {
  return _activeBaseUrl;
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 2500): Promise<Response> {
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
    const loginRes = await fetchWithTimeout(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        username: HEALTH_WORKER_CREDENTIALS.username,
        password: HEALTH_WORKER_CREDENTIALS.password,
      }).toString(),
    }, 2000);

    if (loginRes.ok) {
      const data = await loginRes.json();
      _activeBaseUrl = baseUrl;
      await AsyncStorage.setItem(ACTIVE_HOST_KEY, baseUrl);
      return data.access_token;
    }

    if (loginRes.status === 401) {
      // Register health worker
      const regRes = await fetchWithTimeout(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: HEALTH_WORKER_CREDENTIALS.username,
          password: HEALTH_WORKER_CREDENTIALS.password,
          role: 'health_worker',
          full_name: 'OralCare Field Worker',
        }),
      }, 2000);

      if (regRes.ok) {
        const retry = await fetchWithTimeout(`${baseUrl}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            username: HEALTH_WORKER_CREDENTIALS.username,
            password: HEALTH_WORKER_CREDENTIALS.password,
          }).toString(),
        }, 2000);
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
  if (_cachedToken) return _cachedToken;

  const stored = await AsyncStorage.getItem(TOKEN_KEY);
  if (stored) {
    _cachedToken = stored;
    return stored;
  }

  // Try Wi-Fi IP first (physical device)
  let token = await tryLoginAtHost(API_BASE_URL);

  // If not reachable, try emulator loopback
  if (!token) {
    token = await tryLoginAtHost(EMULATOR_API_BASE_URL);
  }

  // If still not reachable (offline clinic environment), generate a local offline session token
  if (!token) {
    token = `offline_token_${Date.now()}`;
  }

  _cachedToken = token;
  await AsyncStorage.setItem(TOKEN_KEY, token);
  return token;
}

export function useAuth() {
  const [token, setToken] = useState<string | null>(_cachedToken);
  const [loading, setLoading] = useState(!_cachedToken);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (_cachedToken) return;
    getOrFetchToken()
      .then(setToken)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return { token, loading, error };
}

export { getOrFetchToken };
