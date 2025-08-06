const COOKIE_DOMAIN = 'weddyplace.com';
const CANONICAL_TARGET = 'https://www.weddyplace.com/karten';

export default {
  async fetch(request) {
    // Forward the request to the original destination
    const originResponse = await fetch(request);

    // Create a new Headers object to modify cookies
    const newHeaders = new Headers(originResponse.headers);

    const cookieHeaders = [];
    for (const [name, value] of originResponse.headers.entries()) {
      if (name.toLowerCase() === 'set-cookie') {
        let rewrittenCookie = value.replace(/Path=[^;]+/gi, 'Path=/');
        if (/Domain=/i.test(rewrittenCookie)) {
          rewrittenCookie = rewrittenCookie.replace(/Domain=[^;]+/gi, `Domain=${COOKIE_DOMAIN}`);
        } else {
          rewrittenCookie += `; Domain=${COOKIE_DOMAIN}`;
        }
        cookieHeaders.push(rewrittenCookie);
      }
    }

    if (cookieHeaders.length > 0) {
        newHeaders.delete('Set-Cookie');
        cookieHeaders.forEach(cookie => newHeaders.append('Set-Cookie', cookie));
    }


    const contentType = originResponse.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      const rewriter = new HTMLRewriter()
        .on('head', {
          element(element) {
            element.prepend(`
              <script>
                (function() {
                  const newDomain = "${COOKIE_DOMAIN}";
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
        .on('link[rel="canonical"]', {
          element(element) {
            const href = element.getAttribute('href');
            if (href) {
              try {
                const originalUrl = new URL(href);
                const targetUrl = new URL(CANONICAL_TARGET);
                // Append the original path and query to the new target
                const newPath = targetUrl.pathname + originalUrl.pathname + originalUrl.search;
                element.setAttribute('href', targetUrl.origin + newPath);
              } catch (e) {
                // If href is not a valid URL, it might be a relative path
                // In this case, we'll just append it to the target
                const targetUrl = new URL(CANONICAL_TARGET);
                element.setAttribute('href', targetUrl.origin + targetUrl.pathname + href);
              }
            }
          }
        });
      const rewrittenResponse = rewriter.transform(originResponse);
      return new Response(rewrittenResponse.body, {
        status: originResponse.status,
        statusText: originResponse.statusText,
        headers: newHeaders,
      });
    }

    return new Response(originResponse.body, {
      status: originResponse.status,
      statusText: originResponse.statusText,
      headers: newHeaders,
    });
  },
};
