const test = require("node:test");
const assert = require("node:assert/strict");
const { getSafeExternalUrl } = require("./navigation.cjs");

test("allows normal HTTPS external links", () => {
  assert.equal(
    getSafeExternalUrl("https://example.com/help"),
    "https://example.com/help"
  );
});

test("rejects HTTP and non-web URL schemes", () => {
  assert.equal(getSafeExternalUrl("http://example.com"), null);
  assert.equal(getSafeExternalUrl("file:///etc/passwd"), null);
  assert.equal(getSafeExternalUrl("javascript:alert(1)"), null);
  assert.equal(getSafeExternalUrl("data:text/html,hi"), null);
});

test("rejects credential-bearing and malformed URLs", () => {
  assert.equal(getSafeExternalUrl("https://user:password@example.com"), null);
  assert.equal(getSafeExternalUrl("not-a-url"), null);
  assert.equal(getSafeExternalUrl("https://" + "a".repeat(5000) + ".com"), null);
  assert.equal(getSafeExternalUrl(null), null);
});
