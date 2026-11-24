// odyssee/js/core/safe.js — stockage navigateur sûr et journalisation discrète en mode ?debug

/** Indique si le mode diagnostic (?debug ou window.__ODY_DEBUG) est actif */
export function isDebug() {
  try {
    if (typeof window === 'undefined') return false;
    return !!(window.__ODY_DEBUG || /(?:^|[?&])debug(?:=|&|$)/.test(window.location?.search || ''));
  } catch (e) {
    /* ignore: accès window/location restreint */
    return false;
  }
}

/** Journalise une erreur non bloquante uniquement en mode diagnostic */
export function warnDev(scope, err) {
  if (!err || !isDebug()) return;
  try {
    console.warn(`[Odyssée:${scope}]`, err);
  } catch (e) {
    /* ignore: console indisponible */
  }
}

export function storeGet(key, fallback = null) {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const v = localStorage.getItem(key);
    return v != null ? v : fallback;
  } catch (e) {
    warnDev('storage', e);
    return fallback;
  }
}

export function storeSet(key, value) {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(key, String(value));
    return true;
  } catch (e) {
    warnDev('storage', e);
    return false;
  }
}

export function storeDel(key) {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.removeItem(key);
    return true;
  } catch (e) {
    warnDev('storage', e);
    return false;
  }
}

export function sessGet(key, fallback = null) {
  try {
    if (typeof sessionStorage === 'undefined') return fallback;
    const v = sessionStorage.getItem(key);
    return v != null ? v : fallback;
  } catch (e) {
    warnDev('session', e);
    return fallback;
  }
}

export function sessSet(key, value) {
  try {
    if (typeof sessionStorage === 'undefined') return false;
    sessionStorage.setItem(key, String(value));
    return true;
  } catch (e) {
    warnDev('session', e);
    return false;
  }
}

export function sessPop(key, fallback = null) {
  try {
    if (typeof sessionStorage === 'undefined') return fallback;
    const v = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);
    return v != null ? v : fallback;
  } catch (e) {
    warnDev('session', e);
    return fallback;
  }
}
