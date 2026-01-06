
export const normalize = (path: string): string => {
  // Remove leading/trailing slashes and duplicate slashes
  return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
};

export const join = (...parts: string[]): string => {
  const validParts = parts.filter(p => p && p.trim() !== '');
  if (validParts.length === 0) return '';
  return normalize(validParts.join('/'));
};

export const dirname = (path: string): string => {
  const normalized = normalize(path);
  const idx = normalized.lastIndexOf('/');
  if (idx === -1) return ''; // Root
  return normalized.substring(0, idx);
};

export const basename = (path: string): string => {
  const normalized = normalize(path);
  const idx = normalized.lastIndexOf('/');
  if (idx === -1) return normalized;
  return normalized.substring(idx + 1);
};

export const ensureNoLeadingSlash = (path: string): string => {
    return path.startsWith('/') ? path.substring(1) : path;
};
