import { loadCookies } from "./utils";

const USER_AGENT = "terabox;1.37.0.7;PC;PC-Windows;10.0.22631;WindowsTeraBox";
const PUBLIC_RESOLVER = "https://tbx-proxy.shakir-ansarii075.workers.dev/";

function cookieHeader(): string {
  return Object.entries(loadCookies()).map(([key, value]) => `${key}=${value}`).join("; ");
}

function firstDownloadField(value: any): string | null {
  if (!value || typeof value !== "object") return null;
  for (const key of ["dlink", "download_link", "download", "direct_link"]) {
    if (typeof value[key] === "string" && value[key]) return value[key];
  }
  if (Array.isArray(value.list)) return firstDownloadField(value.list[0]);
  if (Array.isArray(value.files)) return firstDownloadField(value.files[0]);
  if (Array.isArray(value.info)) return firstDownloadField(value.info[0]);
  if (Array.isArray(value.dlink)) return firstDownloadField(value.dlink[0]);
  if (value.data) return firstDownloadField(value.data);
  return null;
}

function extractJsToken(html: string): string | null {
  const patterns = [
    /fn%28%22([^%]+?)%22%29/,
    /fn%28%22(.*?)%22%29/,
    /jsToken\s*[:=]\s*["']([^"']+)["']/,
    /jsToken%20%3D%20a%7D%3Bfn%28%22(.*?)%22%29/,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeURIComponent(match[1]);
  }
  return null;
}

function sign(s1: string, s2: string): string {
  const a = new Array<number>(256);
  const p = new Array<number>(256);
  const output: number[] = [];
  for (let q = 0; q < 256; q++) { a[q] = s1.charCodeAt(q % s1.length); p[q] = q; }
  let u = 0;
  for (let q = 0; q < 256; q++) { u = (u + p[q] + a[q]) % 256; [p[q], p[u]] = [p[u], p[q]]; }
  let i = 0;
  u = 0;
  for (let q = 0; q < s2.length; q++) {
    i = (i + 1) % 256;
    u = (u + p[i]) % 256;
    [p[i], p[u]] = [p[u], p[i]];
    const k = p[(p[i] + p[u]) % 256];
    output.push(s2.charCodeAt(q) ^ k);
  }
  return Buffer.from(output).toString("base64");
}

export async function resolveOfficialDownload(fsId: unknown): Promise<string | null> {
  if (fsId === undefined || fsId === null || !String(fsId)) return null;
  const cookie = cookieHeader();
  const baseHeaders: Record<string, string> = {
    Accept: "application/json, text/plain, */*",
    Referer: "https://www.terabox.com/",
    "User-Agent": USER_AGENT,
    "X-Requested-With": "XMLHttpRequest",
  };
  if (cookie) baseHeaders.Cookie = cookie;

  try {
    const home = await fetch("https://www.terabox.com/api/home/info?app_id=250528&web=1&channel=dubox&clienttype=0", { headers: baseHeaders });
    const homeData: any = await home.json();
    const sign1 = homeData?.data?.sign1;
    const sign3 = homeData?.data?.sign3;
    const timestamp = homeData?.data?.timestamp || Math.floor(Date.now() / 1000);
    if (!sign1 || !sign3) return null;

    const params = new URLSearchParams({
      app_id: "250528", web: "1", channel: "dubox", clienttype: "0",
      type: "dlink", fidlist: `[${String(fsId)}]`, sign: sign(sign3, sign1), vip: "2",
      timestamp: String(timestamp),
    });
    const response = await fetch(`https://www.terabox.com/api/download?${params}`, { headers: baseHeaders });
    if (!response.ok) return null;
    const dlink = firstDownloadField(await response.json());
    if (!dlink) return null;
    const resolved = await fetch(dlink, { method: "GET", redirect: "manual", headers: { "User-Agent": USER_AGENT, ...(cookie ? { Cookie: cookie } : {}) } });
    return resolved.headers.get("location") || dlink;
  } catch {
    return null;
  }
}

export async function resolveViaPublicResolver(surl: string): Promise<string | null> {
  const endpoint = new URL(PUBLIC_RESOLVER);
  endpoint.searchParams.set("mode", "resolve");
  endpoint.searchParams.set("surl", surl);
  endpoint.searchParams.set("raw", "1");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(endpoint, { signal: controller.signal, headers: { Accept: "application/json", "User-Agent": USER_AGENT } });
    if (!response.ok) return null;
    return firstDownloadField(await response.json());
  } catch { return null; } finally { clearTimeout(timeout); }
}

export async function tera(surl: string): Promise<any> {
  const shortUrl = surl.startsWith("1") ? surl.substring(1) : surl;
  const cookie = cookieHeader();
  const headers: Record<string, string> = { "User-Agent": USER_AGENT };
  if (cookie) headers.Cookie = cookie;
  const firstUrl = `https://dm.terabox.app/sharing/link?surl=${encodeURIComponent(surl)}`;
  const response = await fetch(firstUrl, { headers });
  const text = await response.text();
  if (!response.ok) return { error: `TeraBox page request failed with HTTP ${response.status}` };
  const jsToken = extractJsToken(text);
  if (!jsToken) return { error: "Failed to extract jsToken. TeraBox may require a current authenticated cookie." };
  const apiUrl = new URL("https://dm.terabox.app/share/list");
  for (const [key, value] of Object.entries({ app_id: "250528", jsToken, site_referer: "https://www.terabox.app/", shorturl: shortUrl, root: "1" })) apiUrl.searchParams.set(key, value);
  const apiHeaders = { ...headers, Accept: "application/json, text/plain, */*", "X-Requested-With": "XMLHttpRequest", Referer: `https://dm.terabox.app/sharing/link?surl=${shortUrl}&clearCache=1`, Origin: "https://dm.terabox.app" };
  const apiResponse = await fetch(apiUrl, { headers: apiHeaders });
  if (!apiResponse.ok) return { error: `TeraBox metadata request failed with HTTP ${apiResponse.status}` };
  return await apiResponse.json();
}
