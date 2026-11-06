/**
 * Public presentation configuration only. Never put tenant credentials here.
 * @param {import("./brand").MobileBrand} input
 * @returns {import("./brand").MobileBrand}
 */
export function defineMobileBrand(input) {
  const fields = ['id', 'displayName', 'supportUrl', 'theme'];
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).some(key => !fields.includes(key))) {
    throw new TypeError('Invalid public brand configuration');
  }
  if (typeof input.id !== 'string' || !/^[a-z][a-z0-9-]{1,47}$/.test(input.id)) {
    throw new TypeError('Invalid brand id');
  }
  if (typeof input.displayName !== 'string' || !input.displayName.trim() || input.displayName.length > 100) {
    throw new TypeError('Invalid display name');
  }
  let supportUrl;
  try { supportUrl = new URL(input.supportUrl); } catch { throw new TypeError('Invalid support URL'); }
  if (supportUrl.protocol !== 'https:' || supportUrl.username || supportUrl.password) {
    throw new TypeError('Support URL must use HTTPS without credentials');
  }
  const tokens = ['canvas', 'surface', 'text', 'muted', 'accent', 'accentText'];
  if (!input.theme || typeof input.theme !== 'object' || Array.isArray(input.theme)
    || Object.keys(input.theme).length !== tokens.length
    || tokens.some(key => typeof input.theme[key] !== 'string' || !/^#[0-9a-f]{6}$/i.test(input.theme[key]))) {
    throw new TypeError('Invalid theme tokens');
  }
  return Object.freeze({
    id: input.id,
    displayName: input.displayName.trim(),
    supportUrl: supportUrl.href,
    theme: Object.freeze({ ...input.theme }),
  });
}
