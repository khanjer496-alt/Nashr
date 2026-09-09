// SPDX-License-Identifier: AGPL-3.0-only
// Only the www alias reaches this Worker. The existing Pages origin is unchanged.
export default {
  fetch(request) {
    const url = new URL(request.url);
    if (url.hostname !== 'www.postdelegate.com') {
      return new Response('Not found', { status: 404 });
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    url.protocol = 'https:';
    url.hostname = 'postdelegate.com';
    url.port = '';
    return new Response(null, {
      status: 301,
      headers: {
        Location: url.href,
        'Cache-Control': 'public, max-age=300',
        'X-Content-Type-Options': 'nosniff',
        Link: '<https://postdelegate.com/licenses>; rel="license"',
      },
    });
  },
};
