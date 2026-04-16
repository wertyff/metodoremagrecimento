import AsyncStorage from "@react-native-async-storage/async-storage";

const AUTH_STORAGE_KEY = "match-intelligence-auth-v1";

const emptyState = {
  sessionEmail: null,
  users: {}
};

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function hashPassword(password) {
  const value = String(password || "");
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) + value.charCodeAt(index);
    hash |= 0;
  }

  return `mi_${Math.abs(hash)}`;
}

function toPublicUser(user) {
  if (!user) return null;

  return {
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

async function readState() {
  const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return emptyState;

  try {
    const parsed = JSON.parse(raw);
    return {
      sessionEmail: parsed.sessionEmail || null,
      users: parsed.users || {}
    };
  } catch {
    return emptyState;
  }
}

async function writeState(state) {
  await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
}

function validateRegistration({ name, email, password, confirmPassword }) {
  if (String(name || "").trim().length < 3) {
    throw new Error("Digite um nome com pelo menos 3 caracteres.");
  }

  const normalizedEmail = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error("Digite um e-mail valido.");
  }

  if (String(password || "").length < 6) {
    throw new Error("A senha precisa ter pelo menos 6 caracteres.");
  }

  if (password !== confirmPassword) {
    throw new Error("A confirmacao da senha nao confere.");
  }
}

export async function loadCurrentAuthUser() {
  const state = await readState();
  const sessionEmail = normalizeEmail(state.sessionEmail);

  if (!sessionEmail) {
    return null;
  }

  return toPublicUser(state.users[sessionEmail]);
}

export async function registerLocalAccount({ name, email, password, confirmPassword }) {
  validateRegistration({ name, email, password, confirmPassword });

  const state = await readState();
  const normalizedEmail = normalizeEmail(email);

  if (state.users[normalizedEmail]) {
    throw new Error("Ja existe uma conta cadastrada com esse e-mail.");
  }

  const timestamp = new Date().toISOString();
  const nextUser = {
    email: normalizedEmail,
    name: String(name || "").trim(),
    passwordHash: hashPassword(password),
    createdAt: timestamp,
    updatedAt: timestamp
  };

  const nextState = {
    ...state,
    sessionEmail: normalizedEmail,
    users: {
      ...state.users,
      [normalizedEmail]: nextUser
    }
  };

  await writeState(nextState);
  return toPublicUser(nextUser);
}

export async function loginLocalAccount({ email, password }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new Error("Digite seu e-mail.");
  }

  if (!password) {
    throw new Error("Digite sua senha.");
  }

  const state = await readState();
  const user = state.users[normalizedEmail];

  if (!user) {
    throw new Error("Conta nao encontrada para esse e-mail.");
  }

  if (user.passwordHash !== hashPassword(password)) {
    throw new Error("Senha incorreta.");
  }

  await writeState({
    ...state,
    sessionEmail: normalizedEmail
  });

  return toPublicUser(user);
}

export async function updateLocalAccountProfile({ name }) {
  if (String(name || "").trim().length < 3) {
    throw new Error("Digite um nome com pelo menos 3 caracteres.");
  }

  const state = await readState();
  const sessionEmail = normalizeEmail(state.sessionEmail);
  const currentUser = state.users[sessionEmail];

  if (!currentUser) {
    throw new Error("Voce precisa estar logado para salvar o perfil.");
  }

  const updatedUser = {
    ...currentUser,
    name: String(name || "").trim(),
    updatedAt: new Date().toISOString()
  };

  await writeState({
    ...state,
    users: {
      ...state.users,
      [sessionEmail]: updatedUser
    }
  });

  return toPublicUser(updatedUser);
}

export async function logoutLocalAccount() {
  const state = await readState();
  await writeState({
    ...state,
    sessionEmail: null
  });
}
