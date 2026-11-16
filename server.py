"""Local FoodPulse web server and server-side AZ Labs API proxy."""

from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlsplit
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parent
AZLABS_COMPARE_URL = "https://azlabs.ai/api/v1/grocery/compare"
PUBLIC_ASSETS = {
    "/": "index.html",
    "/index.html": "index.html",
    "/styles.css": "styles.css",
    "/app.js": "app.js",
    "/live-prices.js": "live-prices.js",
}


def validate_compare_params(query_values: list[str], limit_values: list[str]) -> tuple[str, int]:
    """Validate user input before constructing an upstream request."""
    query = query_values[0].strip() if query_values else ""
    if not query:
        raise ValueError("Enter a product to compare.")
    if len(query) > 120:
        raise ValueError("Search terms must be 120 characters or fewer.")

    try:
        limit = int(limit_values[0]) if limit_values else 5
    except ValueError as exc:
        raise ValueError("Result limit must be a number from 1 to 10.") from exc
    if not 1 <= limit <= 10:
        raise ValueError("Result limit must be a number from 1 to 10.")
    return query, limit


def make_compare_request(query: str, limit: int, api_key: str) -> Request:
    """Create an authenticated request; the key is never sent to the browser."""
    url = f"{AZLABS_COMPARE_URL}?{urlencode({'q': query, 'limit': limit})}"
    return Request(url, headers={"Authorization": f"Bearer {api_key}", "Accept": "application/json"})


def fetch_comparison(query: str, limit: int, api_key: str, opener=None) -> dict:
    """Fetch one live AZ Labs comparison and decode its JSON response."""
    if not api_key:
        raise RuntimeError("AZ Labs API key is not configured on the server.")
    open_url = opener or urlopen
    request = make_compare_request(query, limit, api_key)
    with open_url(request, timeout=25) as response:
        payload = json.loads(response.read().decode("utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("AZ Labs returned an unexpected response.")
    return payload


class FoodPulseHandler(BaseHTTPRequestHandler):
    server_version = "FoodPulse/1.0"

    def log_message(self, format: str, *args) -> None:
        # Do not log search text or upstream response details.
        super().log_message("%s %s", self.command, urlsplit(self.path).path)

    def _send_json(self, status: int, body: dict) -> None:
        encoded = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self) -> None:  # noqa: N802 - required by BaseHTTPRequestHandler
        parsed = urlsplit(self.path)
        if parsed.path == "/api/health":
            self._send_json(200, {"configured": bool(os.environ.get("AZLABS_API_KEY", "").strip())})
            return

        if parsed.path == "/api/grocery/compare":
            try:
                params = parse_qs(parsed.query, keep_blank_values=True)
                query, limit = validate_compare_params(params.get("q", []), params.get("limit", []))
            except ValueError as exc:
                self._send_json(400, {"error": str(exc)})
                return

            api_key = os.environ.get("AZLABS_API_KEY", "").strip()
            if not api_key:
                self._send_json(503, {"error": "Add AZLABS_API_KEY to the server environment to enable live price queries."})
                return

            try:
                result = fetch_comparison(query, limit, api_key)
            except HTTPError as exc:
                messages = {
                    401: "AZ Labs rejected the API key. Check the key in the server environment.",
                    403: "This AZ Labs key or plan cannot access the comparison endpoint.",
                    429: "The AZ Labs request allowance has been reached. Try again after it resets.",
                }
                self._send_json(exc.code if exc.code in (401, 403, 429) else 502,
                                {"error": messages.get(exc.code, "AZ Labs could not complete the price query."), "upstreamStatus": exc.code})
                return
            except (URLError, TimeoutError):
                self._send_json(502, {"error": "Could not reach AZ Labs. Check the connection and try again."})
                return
            except (ValueError, json.JSONDecodeError):
                self._send_json(502, {"error": "AZ Labs returned an invalid response."})
                return

            self._send_json(200, result)
            return

        # Serve only the three public site assets; never expose Python source or dotfiles.
        asset = PUBLIC_ASSETS.get(parsed.path)
        if asset is None:
            self.send_error(404)
            return
        content = (ROOT / asset).read_bytes()
        content_type = "text/html; charset=utf-8" if asset.endswith(".html") else "text/css; charset=utf-8" if asset.endswith(".css") else "text/javascript; charset=utf-8"
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.end_headers()
        self.wfile.write(content)


def main() -> None:
    port = int(os.environ.get("FOODPULSE_PORT", "8000"))
    server = ThreadingHTTPServer(("127.0.0.1", port), FoodPulseHandler)
    print(f"FoodPulse running at http://127.0.0.1:{port} (Ctrl+C to stop)")
    server.serve_forever()


if __name__ == "__main__":
    main()
