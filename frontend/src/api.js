export const API = 'https://sentinel-ai-uaiq.onrender.com';

export async function getJSON(path) {
  try {
    const r = await fetch(`${API}${path}`);

    if (!r.ok) {
      throw new Error(`API error: ${r.status} ${r.statusText}`);
    }

    return await r.json();
  } catch (error) {
    console.error(`GET ${API}${path} failed:`, error);
    throw error;
  }
}

export async function postJSON(path, opts = {}) {
  try {
    const r = await fetch(`${API}${path}`, {
      method: 'POST',
      ...opts
    });

    if (!r.ok) {
      const text = await r.text();
      throw new Error(`API error: ${r.status}: ${text}`);
    }

    return await r.json();
  } catch (error) {
    console.error(`POST ${API}${path} failed:`, error);
    throw error;
  }
}