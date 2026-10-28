/** Keep native routes and assets portable beneath a Next basePath. */
export const appBasePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
export function appPath(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//') || !appBasePath || path === appBasePath || path.startsWith(appBasePath + '/')) return path;
  return appBasePath + path;
}
export function appFetch(input: RequestInfo | URL, init?: RequestInit) {
  return globalThis.fetch(typeof input === 'string' ? appPath(input) : input, init);
}
