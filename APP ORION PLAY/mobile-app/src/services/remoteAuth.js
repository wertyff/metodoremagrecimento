import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

const AUTH_STORAGE_KEY = "match-intelligence-auth-server-v1";
const appExtra =
  Constants.expoConfig?.extra ||
  Constants.manifest2?.extra ||
  {};

export const AUTH_API_BASE_URL =
  appExtra.apiBaseUrl || "https://metodo-seca-rapido-14d.onrender.com";

async function readSession() {
  const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return { token: "", user: null };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      token: parsed.token || "",
      user: parsed.user || null
    };
  } catch {
    return { token: "", user: null };
  }
}

async function writeSession(session) {
  await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

async function clearSession() {
  await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
}

async function getRequiredSession() {
  const session = await readSession();
  if (!session.token) {
    throw new Error("Sessao expirada. Entre de novo para continuar.");
  }

  return session;
}

async function apiRequest(path, { method = "GET", body, token } = {}) {
  const response = await fetch(`${AUTH_API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.error || "Nao foi possivel concluir a operacao.");
    error.statusCode = response.status;
    throw error;
  }

  return payload;
}

async function persistAuthResult(payload) {
  const session = {
    token: payload.token,
    user: payload.user
  };

  await writeSession(session);
  return payload.user;
}

export async function loadRemoteAuthUser() {
  const session = await readSession();
  if (!session.token) {
    return null;
  }

  try {
    const payload = await apiRequest("/api/auth/me", { token: session.token });
    await writeSession({
      token: session.token,
      user: payload.user
    });
    return payload.user;
  } catch {
    await clearSession();
    return null;
  }
}

export async function registerRemoteAccount({ name, email, password, confirmPassword }) {
  const payload = await apiRequest("/api/auth/register", {
    method: "POST",
    body: { name, email, password, confirmPassword }
  });

  return persistAuthResult(payload);
}

export async function loginRemoteAccount({ email, password }) {
  const payload = await apiRequest("/api/auth/login", {
    method: "POST",
    body: { email, password }
  });

  return persistAuthResult(payload);
}

export async function updateRemoteAccountProfile({ name }) {
  const session = await getRequiredSession();

  const payload = await apiRequest("/api/auth/profile", {
    method: "PATCH",
    token: session.token,
    body: { name }
  });

  await writeSession({
    token: session.token,
    user: payload.user
  });

  return payload.user;
}

export async function logoutRemoteAccount() {
  const session = await readSession();
  if (session.token) {
    try {
      await apiRequest("/api/auth/logout", {
        method: "POST",
        token: session.token
      });
    } catch {
      // Ignore remote logout failures and clear the local session anyway.
    }
  }

  await clearSession();
}

export async function requestRemotePasswordReset({ email }) {
  return apiRequest("/api/auth/forgot-password", {
    method: "POST",
    body: { email }
  });
}

export async function resetRemotePassword({ email, token, password, confirmPassword }) {
  const payload = await apiRequest("/api/auth/reset-password", {
    method: "POST",
    body: { email, token, password, confirmPassword }
  });

  return persistAuthResult(payload);
}

export async function fetchRemotePremiumStatus() {
  const session = await getRequiredSession();
  const payload = await apiRequest("/api/subscriptions/me", {
    token: session.token
  });

  await writeSession({
    token: session.token,
    user: payload.user
  });

  return payload;
}

export async function startRemotePremiumSubscription() {
  const session = await getRequiredSession();
  const payload = await apiRequest("/api/subscriptions/premium/start", {
    method: "POST",
    token: session.token
  });

  await writeSession({
    token: session.token,
    user: payload.user
  });

  return payload;
}
