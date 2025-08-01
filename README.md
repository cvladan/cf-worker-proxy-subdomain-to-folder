# Cloudflare Worker - Subdomain to Subfolder Proxy

This Cloudflare Worker proxies requests from a subdomain to a subfolder on another domain, rewriting HTML, CSS, and JavaScript content to ensure all links and resources work correctly.

## How it Works

The worker intercepts requests, modifies the URL to point to the origin server, and then proxies the request. It then processes the response from the origin server, rewriting URLs in the HTML, CSS, and JavaScript to match the target domain and subfolder structure.

### Main Worker (`src/index.js`)

This is the primary worker that handles the proxying and content rewriting. It is designed to be deployed on a route that matches the subfolder path on the target domain.

**Key Features:**

*   **Proxies Requests:** Forwards requests from the target URL (e.g., `https://www.weddyplace.com/karten`) to the origin server (e.g., `https://hochzeitskarten.weddyplace.com`).
*   **Rewrites Cookies:** Modifies `Set-Cookie` headers to ensure they are valid for the target domain.
*   **Rewrites HTML:** Uses `HTMLRewriter` to update attributes like `href`, `src`, and `action` in HTML elements.
*   **Rewrites CSS:** Rewrites `url()` paths in CSS files and inline styles.
*   **Rewrites JavaScript:** Replaces hardcoded origin URLs in JavaScript files and inline scripts.

## How to Use

### Deployment

1.  **Configure `wrangler.toml`:** Set up your Cloudflare account ID and the route for the worker.
2.  **Deploy:** Use the `npm run deploy` command to publish the worker to your Cloudflare account.

**Example `wrangler.toml` configuration:**

```toml
name = "cf-worker-proxy-subdomain-to-folder"
main = "src/index.js"
compatibility_date = "2023-11-21"

[vars]
ORIGIN = "https://hochzeitskarten.weddyplace.com"
TARGET = "https://www.weddyplace.com/karten"

[[routes]]
pattern = "www.weddyplace.com/karten/*"
zone_name = "weddyplace.com"
```

### Local Development

1.  **Install Dependencies:** Run `npm install`.
2.  **Start Dev Server:** Run `npm run start` to test the worker locally.

## Subdomain Worker

A second, simpler worker will be created to handle requests to the subdomain directly. This worker's primary responsibility will be to manage cookies, ensuring a seamless user experience between the two domains. This worker is still under development.
