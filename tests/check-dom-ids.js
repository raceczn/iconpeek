#!/usr/bin/env node
// Regression guard for the exact bug class that shipped in server.js:
// client-side JS calling document.getElementById('someId') where no element
// in the rendered HTML actually has id="someId". That bug doesn't throw
// anywhere the server can see it (it only fails in the browser, on certain
// config inputs), so a plain "does the page load" smoke test won't catch it.
//
// This diffs every getElementById() reference in the fetched page against
// every id="..." attribute actually present in that same page, live, so it
// always reflects the real createHtml() output rather than a stale copy.
//
// Usage: node check-dom-ids.js <url>
// Exit 0 = every referenced id exists. Exit 1 = at least one is missing.

const http = require('http');

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`GET ${url} returned ${res.statusCode}`));
          return;
        }
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(data));
      })
      .on('error', reject);
  });
}

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: check-dom-ids.js <url>');
    process.exit(2);
  }

  const html = await fetchHtml(url);

  const referenced = new Set();
  const refPattern = /getElementById\(\s*['"]([^'"]+)['"]\s*\)/g;
  let match;
  while ((match = refPattern.exec(html))) {
    referenced.add(match[1]);
  }

  const defined = new Set();
  const defPattern = /\bid=["']([^"']+)["']/g;
  while ((match = defPattern.exec(html))) {
    defined.add(match[1]);
  }

  const missing = [...referenced].filter((id) => !defined.has(id));

  if (missing.length) {
    console.error('FAIL: JS references DOM ids that do not exist in the rendered HTML:');
    missing.forEach((id) => console.error(`  - ${id}`));
    process.exit(1);
  }

  console.log(
    `OK: all ${referenced.size} getElementById() references resolve to a real element (${defined.size} ids defined on page).`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(2);
});
