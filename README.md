# TeraBox Downloader API

A Vercel-compatible serverless API that resolves TeraBox share URLs into file metadata and direct download links when TeraBox permits the request.

## Deployment

The repository is configured for Vercel. The function is located at `api/index.ts`, so the production endpoint is:

```text
https://YOUR-PROJECT.vercel.app/api?url=https://terabox.app/s/SHARE_ID
```

Every push to the `main` branch deploys automatically after the repository is linked to Vercel.

## Configuration

The API works without an environment variable when TeraBox allows anonymous access. If TeraBox requires a session, add a current cookie as the Vercel project environment variable `COOKIE_JSON`:

```json
{"ndus":"your-current-cookie-value"}
```

Do not commit `.env` files or cookie values. Use `.env.example` as the template.

## API

### `GET /api`

Query parameter:

| Parameter | Required | Description |
| --- | --- | --- |
| `url` | Yes | A supported TeraBox share URL, such as `https://terabox.app/s/...` |

Example:

```bash
curl 'https://YOUR-PROJECT.vercel.app/api?url=https%3A%2F%2Fterabox.app%2Fs%2F1HSEb8PZRUE7Z1Tvd3ZtT0g'
```

The function also supports `OPTIONS` for browser CORS preflight requests and returns JSON errors for missing or invalid URLs. TeraBox upstream failures are returned as a structured error rather than exposing internal details.

## Local checks

```bash
npm install
npm run build
```

For a local Vercel runtime, install the Vercel CLI and run `npm run dev`.
