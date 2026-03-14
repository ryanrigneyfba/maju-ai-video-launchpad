'use strict';

async function check(urls) {
  const errors = [];
  for (const [label, url] of Object.entries(urls)) {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (res.status < 200 || res.status >= 400)
        errors.push(`${label}: HTTP ${res.status}`);
    } catch (err) {
      errors.push(`${label}: ${err.message}`);
    }
  }
  return errors;
}

module.exports = { check };
