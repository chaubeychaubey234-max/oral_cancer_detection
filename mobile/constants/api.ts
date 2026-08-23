/**
 * Central API configuration for the OralCare mobile app.
 */

// Primary real Wi-Fi IP of your laptop (accessible from physical Android phones)
export const DEFAULT_LAN_HOST = '10.35.130.75';
export const EMULATOR_HOST = '10.0.2.2';

// Primary backend port
export const BACKEND_PORT = 8000;

export const API_BASE_URL = `http://${DEFAULT_LAN_HOST}:${BACKEND_PORT}`;
export const EMULATOR_API_BASE_URL = `http://${EMULATOR_HOST}:${BACKEND_PORT}`;

// ── Endpoints ──────────────────────────────────────────────────────────────
export const ENDPOINTS = {
  login: `${API_BASE_URL}/auth/login`,
  register: `${API_BASE_URL}/auth/register`,
  createPatient: `${API_BASE_URL}/patients`,
  createCase: `${API_BASE_URL}/cases`,
  getCase: (id: string) => `${API_BASE_URL}/cases/${id}`,
  health: `${API_BASE_URL}/health`,
} as const;

// ── Seeded health-worker credentials ───────────────────────────────────────
export const HEALTH_WORKER_CREDENTIALS = {
  username: 'asha1',
  password: 'asha12345',
} as const;
