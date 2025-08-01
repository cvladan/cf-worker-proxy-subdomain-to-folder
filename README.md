# Cloudflare Worker - Subdomain to Subfolder Proxy

**Important:** For this setup to work, both the main domain (e.g., `www.weddyplace.com`) and the subdomain (e.g., `hochzeitskarten.weddyplace.com`) must be proxied through Cloudflare.
This Cloudflare Worker proxies requests from a subdomain to a subfolder on another domain, rewriting HTML, CSS, and JavaScript content to ensure all links and resources work correctly.

## How it Works

The worker intercepts requests, modifies the URL to point to the origin server, and then proxies the request. It then processes the response from the origin server, rewriting URLs in the HTML, CSS, and JavaScript to match the target domain and subfolder structure.

### Main Worker (`src/index.js`)

This is the primary worker that handles the proxying and content rewriting. It is designed to be deployed on a route that matches the subfolder path on the target domain.

**Key Features:**

*   **Proxies Requests:** Forwards requests from the target URL (e.g., `https://www.weddyplace.com/karten`) to the origin server (e.g., `https://hochzeitskarten.weddyplace.com`).
*   **Rewrites Cookies:** Rewrites `Set-Cookie` headers to the parent domain with a path of `/`.
*   **Rewrites HTML:** Uses `HTMLRewriter` to update attributes like `href`, `src`, and `action` in HTML elements.
*   **Rewrites CSS:** Rewrites `url()` paths in CSS files and inline styles.
*   **Rewrites JavaScript:** Replaces hardcoded origin URLs in JavaScript files and inline scripts.
*   **Handles Exception Paths:** Certain paths (defined in `REWRITE_TO_ORIGIN_PATHS`) are not proxied to the subfolder but are instead rewritten to point back to the original `ORIGIN` domain. This is useful for things like account pages, login/logout functionality, etc. that should not be part of the subfolder structure. For example, a path like `/account` will be rewritten to `https://hochzeitskarten.weddyplace.com/account`.

## How to Use

This project includes two separate workers, each with its own configuration file.

### Main Worker (`src/index.js`)

This is the primary worker that handles the proxying and content rewriting. It is configured using `wrangler.jsonc`.

**To deploy the main worker:**

```bash
npx wrangler deploy --config wrangler.jsonc
```

### Subdomain Worker (`src/subdomain-worker.js`)

This worker is intended to be deployed on the subdomain route. It rewrites cookies to the parent domain with a path of `/` and also rewrites canonical link tags in HTML content to point to the target subfolder URL. It is configured using `wrangler.subdomain.jsonc`.

**To deploy the subdomain worker:**

```bash
npx wrangler deploy --config wrangler.subdomain.jsonc
```

### Local Development

1.  **Install Dependencies:** Run `npm install`.
2.  **Start Dev Server for Main Worker:**
    ```bash
    npx wrangler dev --config wrangler.jsonc
    ```
3.  **Start Dev Server for Subdomain Worker:**
    ```bash
    npx wrangler dev --config wrangler.subdomain.jsonc
    ```
