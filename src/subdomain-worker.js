const TARGET_DOMAIN = 'weddyplace.com';

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
          rewrittenCookie = rewrittenCookie.replace(/Domain=[^;]+/gi, `Domain=${TARGET_DOMAIN}`);
        } else {
          rewrittenCookie += `; Domain=${TARGET_DOMAIN}`;
        }
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
