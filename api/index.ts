import { resolveOfficialDownload, resolveViaPublicResolver, tera } from "../src/lib/terabox";
import { extractSurl, formatBytes, isValidShareUrl } from "../src/lib/utils";

const cache = new Map<string, { data: any; expiry: number }>();
const CACHE_DURATION = 2 * 60 * 60 * 1000;
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

function sendJson(res: any, status: number, body: unknown): void {
  res.statusCode = status;
  for (const [key, value] of Object.entries(corsHeaders)) res.setHeader(key, value);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

async function resolveDownloadUrl(dlink: unknown): Promise<string | null> {
  if (typeof dlink !== "string" || !dlink) return null;
  try {
    const response = await fetch(dlink, { method: "HEAD", redirect: "manual", headers: { "User-Agent": "Mozilla/5.0" } });
    return response.headers.get("location") || dlink;
  } catch { return dlink; }
}

export default async function handler(req: any, res: any): Promise<void> {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    for (const [key, value] of Object.entries(corsHeaders)) res.setHeader(key, value);
    res.end();
    return;
  }
  if (req.method !== "GET") {
    sendJson(res, 405, { status: "error", message: "Method not allowed" });
    return;
  }

  const requestUrl = new URL(req.url || "/api", "https://vercel.local");
  const targetUrlRaw = requestUrl.searchParams.get("url");
  if (!targetUrlRaw || !targetUrlRaw.trim()) {
    sendJson(res, 400, { status: "error", message: "Missing required parameter: url" });
    return;
  }
  const targetUrl = targetUrlRaw.trim();
  if (!isValidShareUrl(targetUrl)) {
    sendJson(res, 400, { status: "error", message: "Invalid TeraBox share URL" });
    return;
  }
  const surl = extractSurl(targetUrl);
  if (!surl) {
    sendJson(res, 400, { status: "error", message: "Could not extract surl from URL" });
    return;
  }

  const startTime = Date.now();
  try {
    const cached = cache.get(surl);
    const data = cached && Date.now() < cached.expiry ? cached.data : await tera(surl);
    if (!cached || Date.now() >= cached.expiry) cache.set(surl, { data, expiry: Date.now() + CACHE_DURATION });
    if (data?.error) {
      sendJson(res, 502, { status: "error", message: data.error });
      return;
    }

    const firstItem = data?.list?.[0];
    if (!firstItem) {
      sendJson(res, 502, { status: "error", message: "TeraBox returned no file metadata" });
      return;
    }

    let download = await resolveDownloadUrl(firstItem.dlink);
    let resolver = download ? "terabox" : null;
    if (!download) {
      download = await resolveOfficialDownload(firstItem.fs_id);
      if (download) resolver = "terabox-official";
    }
    if (!download) {
      const publicDlink = await resolveViaPublicResolver(surl);
      download = await resolveDownloadUrl(publicDlink);
      if (download) resolver = "public-resolver";
    }

    if (!download) {
      sendJson(res, 502, {
        status: "error",
        message: "No direct download link was returned by TeraBox or the public resolver",
        filename: firstItem.server_filename || null,
      });
      return;
    }

    sendJson(res, 200, {
      status: "success",
      filename: firstItem.server_filename || null,
      size: firstItem.size !== undefined ? formatBytes(firstItem.size) : null,
      download,
      thumbnail: firstItem.thumbs?.url3 || firstItem.thumbs?.url1 || null,
      resolver,
      response_time: `${((Date.now() - startTime) / 1000).toFixed(3)}s`,
    });
  } catch (error) {
    console.error("TeraBox request failed", error);
    sendJson(res, 500, { status: "error", message: "Unable to resolve TeraBox file" });
  }
}
