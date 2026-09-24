import fs from "fs";
import path from "path";
import { URL } from "url";

export const ALLOWED_HOSTS = new Set([
  "terabox.app", "www.terabox.app", "teraboxshare.com", "www.teraboxshare.com",
  "terabox.com", "www.terabox.com", "1024terabox.com", "www.1024terabox.com",
  "teraboxlink.com", "www.teraboxlink.com", "dm.terabox.app",
]);

export function loadCookies(): Record<string, string> {
  const header = process.env.TERABOX_COOKIE_HEADER;
  if (header) {
    const result: Record<string, string> = {};
    for (const part of header.split(";")) {
      const separator = part.indexOf("=");
      if (separator > 0) result[part.slice(0, separator).trim()] = part.slice(separator + 1).trim();
    }
    if (Object.keys(result).length) return result;
  }

  let data: Record<string, any> | null = null;
  const cookieJson = process.env.COOKIE_JSON;
  if (cookieJson) {
    try {
      data = JSON.parse(cookieJson);
    } catch {
      const trimmed = cookieJson.trim();
      if (trimmed) data = { ndus: trimmed };
    }
  }
  if (!data) {
    const raw = process.env.TERABOX_COOKIES_JSON;
    if (raw) {
      try { data = JSON.parse(raw); } catch { /* ignore malformed fallback */ }
    }
  }
  if (!data) {
    const filePath = process.env.TERABOX_COOKIES_FILE;
    if (filePath) {
      try {
        if (fs.existsSync(path.resolve(filePath))) data = JSON.parse(fs.readFileSync(path.resolve(filePath), "utf-8"));
      } catch { /* ignore unavailable local file */ }
    }
  }
  if (!data || typeof data !== "object") return {};
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value)]));
}

export function isValidShareUrl(u: string): boolean {
  try {
    const parsed = new URL(u);
    return ["http:", "https:"].includes(parsed.protocol) && ALLOWED_HOSTS.has(parsed.hostname.toLowerCase()) &&
      (parsed.pathname.includes("/s/") || parsed.searchParams.has("surl"));
  } catch { return false; }
}

export function extractSurl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has("surl")) return parsed.searchParams.get("surl");
    return parsed.pathname.match(/\/s\/([a-zA-Z0-9_-]+)/)?.[1] || null;
  } catch { return null; }
}

export function formatBytes(bytes: number | string, decimals = 2): string {
  const b = typeof bytes === "string" ? parseInt(bytes, 10) : bytes;
  if (!Number.isFinite(b) || b <= 0) return "0 Bytes";
  const i = Math.floor(Math.log(b) / Math.log(1024));
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  return `${parseFloat((b / Math.pow(1024, i)).toFixed(Math.max(0, decimals)))} ${sizes[i]}`;
}
