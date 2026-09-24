import { loadCookies } from "./utils";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/145.0.0.0 Safari/537.36";

export async function tera(surl: string): Promise<any> {
  const shortUrl = surl.startsWith("1") ? surl.substring(1) : surl;
  const cookies = loadCookies();
  const cookieString = Object.entries(cookies).map(([key, value]) => `${key}=${value}`).join("; ");
  const headers: Record<string, string> = { "User-Agent": USER_AGENT };
  if (cookieString) headers.Cookie = cookieString;

  const firstUrl = `https://dm.terabox.app/sharing/link?surl=${encodeURIComponent(surl)}`;
  const response = await fetch(firstUrl, { headers });
  const text = await response.text();
  if (!response.ok) return { error: `TeraBox page request failed with HTTP ${response.status}` };

  const match = text.match(/fn%28%22(.*?)%22%29/);
  if (!match) return { error: "Failed to extract jsToken. TeraBox may require a current authenticated cookie." };

  const apiUrl = new URL("https://dm.terabox.app/share/list");
  apiUrl.searchParams.set("app_id", "250528");
  apiUrl.searchParams.set("jsToken", match[1]);
  apiUrl.searchParams.set("site_referer", "https://www.terabox.app/");
  apiUrl.searchParams.set("shorturl", shortUrl);
  apiUrl.searchParams.set("root", "1");

  const apiHeaders: Record<string, string> = {
    "User-Agent": USER_AGENT,
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "X-Requested-With": "XMLHttpRequest",
    Referer: `https://dm.terabox.app/sharing/link?surl=${shortUrl}&clearCache=1`,
    "Content-Type": "application/x-www-form-urlencoded",
    Origin: "https://dm.terabox.app",
  };
  if (cookieString) apiHeaders.Cookie = cookieString;

  const apiResponse = await fetch(apiUrl, { headers: apiHeaders });
  if (!apiResponse.ok) return { error: `TeraBox metadata request failed with HTTP ${apiResponse.status}` };
  return await apiResponse.json();
}
