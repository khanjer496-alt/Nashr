import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../../ops/cloudflare/www-redirect/worker.mjs';

for (const source of ['http://www.postdelegate.com/', 'https://www.postdelegate.com/', 'https://www.postdelegate.com/privacy?utm_source=launch', 'https://www.postdelegate.com/a%2Fb?q=one%20two']) {
  test(`www redirect preserves the path and query: ${source}`, () => {
    const request = new Request(source);
    const response = worker.fetch(request);
    const target = new URL(source);
    target.protocol = 'https:';
    target.hostname = 'postdelegate.com';
    assert.equal(response.status, 301);
    assert.equal(response.headers.get('location'), target.href);
  });
}
test('HEAD redirects without a response body', async () => {
  const response = worker.fetch(new Request('https://www.postdelegate.com/', { method: 'HEAD' }));
  assert.equal(response.status, 301);
  assert.equal(await response.text(), '');
});
test('the apex, preview origins and arbitrary hosts cannot enter a redirect loop', () => {
  for (const host of ['postdelegate.com', 'postdelegate.pages.dev', 'example.org']) {
    assert.equal(worker.fetch(new Request(`https://${host}/`)).status, 404);
  }
});
test('incoming query parameters cannot choose the redirect destination', () => {
  const response = worker.fetch(new Request('https://www.postdelegate.com/?next=https://example.org'));
  assert.equal(new URL(response.headers.get('location')).origin, 'https://postdelegate.com');
});
test('non-navigation methods are rejected without forwarding data', () => {
  const response = worker.fetch(new Request('https://www.postdelegate.com/', { method: 'POST', body: 'private' }));
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET, HEAD');
  assert.equal(response.headers.get('location'), null);
});
