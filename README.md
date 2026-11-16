# FoodPulse SA

FoodPulse is a browser-based grocery comparison preview. AZ Labs live comparisons are proxied by a small Python server so the API key never enters browser JavaScript.

## Run on Windows 11

1. Create an AZ Labs Grocery API key in your AZ Labs account. The provider documents a free tier with request limits.
2. In PowerShell, set the key for this terminal session and start FoodPulse:

   ```powershell
   $secret = Read-Host "AZ Labs API key" -AsSecureString
   $env:AZLABS_API_KEY = [System.Net.NetworkCredential]::new("", $secret).Password
   py server.py
   ```

3. Open `http://127.0.0.1:8000` in your browser. Search for a product and select **Search live prices**.
4. Stop the server with `Ctrl+C`. The key remains only in that PowerShell process environment; do not put it in a source file or commit it.

If the `py` launcher is unavailable, use `python server.py` instead. Set another local port with `$env:FOODPULSE_PORT = "8001"` before starting the server.

## Data and licensing

The overview cards are illustrative demo content. Search results are fetched from AZ Labs at query time and include the retailer/store context and fetch time returned by the provider. AZ Labs says its service does not grant rights over retailer content and asks users to contact them before storing or republishing prices. Obtain permission for FoodPulse's intended display and retention before deploying this integration to end users. Product searches are sent to AZ Labs when submitted.

## Tests

The standard-library tests do not call AZ Labs or require an API key:

```powershell
py -m unittest discover -s tests -v
```

