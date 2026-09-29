export const API = 'https://sentinel-ai-uaiq.onrender.com';

export async function getJSON(path) {
  const r = await fetch(`${API}${path}`);
  return r.json();
}

export async function postJSON(path, opts = {}) {
  const r = await fetch(`${API}${path}`, { method: 'POST', ...opts });
  return r.json();
}
