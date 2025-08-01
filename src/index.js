const ORIGIN = 'https://hochzeitskarten.weddyplace.com';
const TARGET = 'https://www.weddyplace.com/karten';

const REWRITE_TO_ORIGIN_PATHS = [
  '/account',
  '/eigen_collectie',
  '/account_orders',
  '/account_adresboek',
  '/account_address',
  '/account_password',
  '/account_email_preferences',
  '/account_privacy',
  '/logout',
  '/create/basket',
];

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const targetUrl = new URL(TARGET);
    const originUrl = new URL(ORIGIN);

    // Build origin request URL
    const path = url.pathname.replace(new RegExp(`^${targetUrl.pathname}`), '');
    const originRequestUrl = `${ORIGIN}${path}${url.search}`;

    // Proxy request to origin
    const originRequest = new Request(originRequestUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: 'manual'
    });
    originRequest.headers.set('Host', originUrl.hostname);

    const originResponse = await fetch(originRequest);

    // Rewrite Set-Cookie headers
    const newHeaders = new Headers(originResponse.headers);
    const cookieHeaders = [];
    const parentDomain = targetUrl.hostname.split('.').slice(-2).join('.');

    for (const [name, value] of originResponse.headers.entries()) {
      if (name.toLowerCase() === 'set-cookie') {
        let rewrittenCookie = value.replace(/Path=[^;]+/gi, 'Path=/');
        if (/Domain=/i.test(rewrittenCookie)) {
          rewrittenCookie = rewrittenCookie.replace(/Domain=[^;]+/gi, `Domain=${parentDomain}`);
        } else {
          rewrittenCookie += `; Domain=${parentDomain}`;
        }
        cookieHeaders.push(rewrittenCookie);
      }
    }
    if (cookieHeaders.length > 0) {
      newHeaders.delete('Set-Cookie');
      cookieHeaders.forEach(cookie => newHeaders.append('Set-Cookie', cookie));
    }

    // Check content type

    // Cache compiled regexes
    const CSS_URL_PATTERN = /url\((['"]?)([^)'"]*)(\1)\)/g;
    const ORIGIN_PATTERN = new RegExp(escapeRegExp(ORIGIN), 'g');

    // Use more specific content-type checks
    function isContentType(headers, types) {
      const contentType = headers.get('content-type')?.toLowerCase() || '';
      return types.some(type => contentType.includes(type));
    }

    const isHTML = isContentType(originResponse.headers, ['text/html']);
    const isCSS = isContentType(originResponse.headers, ['text/css']) || path.endsWith('.css');
    const isJS = isContentType(originResponse.headers, ['javascript', 'application/javascript']) || path.endsWith('.js');

    // Process CSS files
    if (isCSS) {
      const cssContent = await originResponse.text();
      const rewrittenCSS = rewriteCSSContent(cssContent);

      return new Response(rewrittenCSS, {
        status: originResponse.status,
        statusText: originResponse.statusText,
        headers: newHeaders
      });
    }

    // Process JavaScript files
    if (isJS) {
      const jsContent = await originResponse.text();
      const rewrittenJS = rewriteJavaScriptContent(jsContent);

      return new Response(rewrittenJS, {
        status: originResponse.status,
        statusText: originResponse.statusText,
        headers: newHeaders
      });
    }

    // Process HTML files
    if (isHTML) {
      const rewriter = new HTMLRewriter()
        .on('head', {
          element(element) {
            element.prepend(`
              <script>
                (function() {
                  const newDomain = "${parentDomain}";
                  const originalCookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
                  if (!originalCookieDescriptor) {
                      console.error("Could not get original cookie descriptor.");
                      return;
                  }
                  Object.defineProperty(Document.prototype, 'cookie', {
                      get: function() {
                          return originalCookieDescriptor.get.call(document);
                      },
                      set: function(cookieString) {
                          let modifiedCookieString = cookieString;
                          const domainRegex = /;\\s*domain=[^;]+/i;
                          if (domainRegex.test(cookieString)) {
                              modifiedCookieString = cookieString.replace(domainRegex, \`; domain=\${newDomain}\`);
                          } else {
                              modifiedCookieString = \`\${cookieString}; domain=\${newDomain}\`;
                          }
                          originalCookieDescriptor.set.call(document, modifiedCookieString);
                      }
                  });
                })();
              </script>
            `, { html: true });
          }
        })
        .on('a, img, link, script, iframe, form, source, track, video, audio', new AttributeRewriter(['href', 'src', 'action']))
        .on('meta', new AttributeRewriter(['content']))
        .on('*', new AttributeRewriter(['data-url', 'data-href', 'data-src', 'data-action']))
        .on('style', new CSSRewriter())
        .on('script', new JavaScriptRewriter());

      const rewrittenResponse = rewriter.transform(originResponse);
      return new Response(rewrittenResponse.body, {
        status: originResponse.status,
        statusText: originResponse.statusText,
        headers: newHeaders,
      });
    }

    // For other file types, return as-is
    return new Response(originResponse.body, {
      status: originResponse.status,
      statusText: originResponse.statusText,
      headers: newHeaders
    });
  }
};

function isExceptionPath(path) {
  for (const exceptionPath of REWRITE_TO_ORIGIN_PATHS) {
    if (path.startsWith(exceptionPath)) {
      return true;
    }
  }
  return false;
}

function rewritePath(path) {
  if (!path || typeof path !== 'string') return path;

  const targetUrl = new URL(TARGET);
  const originUrl = new URL(ORIGIN);

  // Handle exception paths - prepend with ORIGIN domain
  if (isExceptionPath(path)) {
    // If it's already a full URL with ORIGIN, return as-is
    if (path.startsWith(ORIGIN)) {
      return path;
    }
    // If it's an absolute path, prepend with ORIGIN
    if (path.startsWith('/')) {
      return `${ORIGIN}${path}`;
    }
    return path;
  }

  // Skip if already rewritten to TARGET
  if (path.startsWith(targetUrl.pathname + '/') || path.startsWith(targetUrl.pathname + '?')) {
    return path;
  }

  // Handle full origin URLs - rewrite to TARGET
  if (path.startsWith(ORIGIN)) {
    const relativePath = path.substring(ORIGIN.length);
    return `${targetUrl.pathname}${relativePath}`;
  }

  // Handle protocol-relative URLs
  if (path.startsWith(`//${originUrl.hostname}`)) {
    const relativePath = path.substring(`//${originUrl.hostname}`.length);
    return `${targetUrl.pathname}${relativePath}`;
  }

  // Handle absolute paths - rewrite to TARGET
  if (path.startsWith('/')) {
    return `${targetUrl.pathname}${path}`;
  }

  // Skip relative paths and external URLs
  return path;
}


// Function to rewrite CSS content
function rewriteCSSContent(cssText) {
  const targetUrl = new URL(TARGET);

  // Pattern for site-root-relative URLs
  const relativePattern = /url\((['"]?)\/([^)'"]*)(\1)\)/g;

  // Pattern for origin absolute URLs
  const escapedOrigin = ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const domainPattern = new RegExp(
    `url\\((['"]?)${escapedOrigin}([^)'"]*)\\1\\)`,
    'g'
  );

  return cssText
    .replace(domainPattern, (match, quote, path) => {
      const fullPath = `${ORIGIN}${path}`;
      const rewritten = rewritePath(fullPath);
      return `url(${quote}${rewritten}${quote})`;
    })
    .replace(relativePattern, (match, quote, path, endQuote) => {
      const rewritten = rewritePath(`/${path}`);
      return `url(${quote}${rewritten}${endQuote})`;
    });
}

// Function to rewrite JavaScript content
function rewriteJavaScriptContent(jsText) {
  return jsText
    // Replace full origin URLs - use rewritePath for consistent handling
    .replace(new RegExp(escapeRegExp(ORIGIN) + '([^\\s"\']*)', 'g'), (match, pathPart) => {
      const fullPath = `${ORIGIN}${pathPart}`;
      return rewritePath(fullPath);
    })
    // Replace quoted absolute paths - FIXED: require / immediately after quote
    .replace(/(['"`])(\/)([a-zA-Z0-9][a-zA-Z0-9._\/-]*(?:\.[a-zA-Z]{2,4})?(?:\?[^'"`]*)?)\1/g,
      (match, quote, slash, path) => {
        const fullPath = slash + path;
        // More strict validation - must look like a web resource path
        if (
          // Has file extension
          fullPath.match(/\.(js|css|json|svg|png|jpg|jpeg|gif|webp|html|php|xml|txt|ico|woff|woff2|ttf|eot)(\?|$)/i) ||
          // Starts with common web directories
          fullPath.match(/^\/(api|assets|static|js|css|img|images|fonts|media|uploads|files|public)\b/i) ||
          // Looks like an API endpoint
          fullPath.match(/^\/(api|ajax|rest|graphql)\b/i)
        ) {
          return `${quote}${rewritePath(fullPath)}${quote}`;
        }
        return match;
      });
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Generic handler to rewrite element attributes
class AttributeRewriter {
  constructor(attributeNames) {
    this.attributeNames = Array.isArray(attributeNames) ? attributeNames : [attributeNames];
  }

  element(element) {
    this.attributeNames.forEach(attr => {
      const value = element.getAttribute(attr);
      if (!value) return;

      const updated = rewritePath(value);

      if (updated !== value) {
        element.setAttribute(attr, updated);
      }
    });
  }
}

// Handler to rewrite url()s inside inline CSS
class CSSRewriter {
  text(text) {
    const rewritten = rewriteCSSContent(text.text);
    if (rewritten !== text.text) {
      text.replace(rewritten, { html: true });
    }
  }
}

// Handler to rewrite paths inside inline JavaScript
class JavaScriptRewriter {
  text(text) {
    const rewritten = rewriteJavaScriptContent(text.text);
    if (rewritten !== text.text) {
      text.replace(rewritten, { html: true });
    }
  }
}
