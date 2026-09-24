import { tera } from "../src/lib/terabox";
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
  for (const [key, value] of Object.entries(corsHeaders)) {
    res.setHeader(key, value);
  }
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
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
    sendJson(res, 400, {
      status: "error",
      message: "Missing required parameter: url",
      example: "/api?url=https://terabox.app/s/1HSEb8PZRUE7Z1Tvd3ZtT0g",
    });
    return;
  }

  const targetUrl = targetUrlRaw.trim();
  if (!isValidShareUrl(targetUrl)) {
    sendJson(res, 400, {
      status: "error",
      url: targetUrl,
      message: "Invalid TeraBox share URL",
    });
    return;
  }

  const surl = extractSurl(targetUrl);
  if (!surl) {
    sendJson(res, 400, {
      status: "error",
      url: targetUrl,
      message: "Could not extract surl from URL",
    });
    return;
  }

  const startTime = Date.now();
  try {
    const cached = cache.get(surl);
    const data = cached && Date.now() < cached.expiry
      ? cached.data
      : await tera(surl);

    if (!cached || Date.now() >= cached.expiry) {
      cache.set(surl, { data, expiry: Date.now() + CACHE_DURATION });
    }

    const responseTime = `${((Date.now() - startTime) / 1000).toFixed(3)}s`;
    if (data?.error) {
      sendJson(res, 502, {
        status: "error",
        url: targetUrl,
        surl,
        error: data.error,
        response_time: responseTime,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const firstItem = data?.list?.[0];
    sendJson(res, 200, {
      status: "success",
      response_time: responseTime,
      url: targetUrl,
      ...(firstItem?.server_filename && { filename: firstItem.server_filename }),
      ...(firstItem?.size !== undefined && { size: formatBytes(firstItem.size) }),
      ...(firstItem?.dlink && { download: firstItem.dlink }),
      ...(firstItem?.thumbs && { thumbs: firstItem.thumbs }),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("TeraBox request failed", error);
    sendJson(res, 500, {
      status: "error",
      message: "Unable to fetch TeraBox metadata",
      url: targetUrl,
    });
  }
}
