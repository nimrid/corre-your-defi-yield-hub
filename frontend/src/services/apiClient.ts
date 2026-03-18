export const API_PREFIX = "/api";

const normalizePath = (path: string) => {
  if (!path) return "/";
  return path.startsWith("/") ? path : `/${path}`;
};

export const apiUrl = (path: string) => `${API_PREFIX}${normalizePath(path)}`;

export const apiFetch = (path: string, init?: RequestInit) =>
  fetch(apiUrl(path), init);
