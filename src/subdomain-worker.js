const TARGET_DOMAIN = 'www.weddyplace.com';
const TARGET_PATH = '/karten';

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Forward the request to the original destination
    const originResponse = await fetch(request);

    // Create a new Headers object to modify cookies
    const newHeaders = new Headers(originResponse.headers);

    const cookieHeaders = [];
    for (const [name, value] of originResponse.headers.entries()) {
      if (name.toLowerCase() === 'set-cookie') {
        const rewrittenCookie = value
          .replace(/Domain=[^;]+/gi, `Domain=${TARGET_DOMAIN}`)
          .replace(/Path=[^;]+/gi, `Path=${TARGET_PATH}`);
        cookieHeaders.push(rewrittenCookie);
      }
    }

    if (cookieHeaders.length > 0) {
      newHeaders.delete('Set-Cookie');
      cookieHeaders.forEach(cookie => newHeaders.append('Set-Cookie', cookie));
    }

    return new Response(originResponse.body, {
      status: originResponse.status,
      statusText: originResponse.statusText,
      headers: newHeaders,
    });
  },
};
