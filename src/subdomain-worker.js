const TARGET_DOMAIN = 'www.weddyplace.com';
const TARGET_PATH = '/karten';

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Forward the request to the original destination
    const originResponse = await fetch(request);

    // Create a new Headers object to modify cookies
    const newHeaders = new Headers(originResponse.headers);

    const originalCookies = originResponse.headers.getAll('Set-Cookie');

    originalCookies.forEach(cookie => {
      const rewrittenCookie = cookie
        .replace(/Domain=[^;]+/gi, `Domain=${TARGET_DOMAIN}`)
        .replace(/Path=[^;]+/gi, `Path=${TARGET_PATH}`);

      newHeaders.append('Set-Cookie', rewrittenCookie);
    });

    return new Response(originResponse.body, {
      status: originResponse.status,
      statusText: originResponse.statusText,
      headers: newHeaders,
    });
  },
};
