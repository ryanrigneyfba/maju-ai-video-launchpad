'use strict';

const { fetchJSON } = require('./http');
const { getKey, MAJU_SERVER } = require('../config');

const NETWORKS = ['instagram', 'tiktok', 'youtube', 'facebook', 'twitter'];

async function publish(streamUrl, caption, hashtags) {
  const token   = getKey('metricoolToken');
  const blogId  = getKey('metricoolBlogId');
  const fullText = `${caption}\n\n${hashtags.map(h => `#${h}`).join(' ')}`;

  // Normalize URL for Metricool
  const normalizeRes = await fetchJSON(`${MAJU_SERVER}/api/proxy/metricool/normalize`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'x-metricool-token': token,
      'x-blog-id':     String(blogId),
    },
    body: JSON.stringify({ url: streamUrl }),
  });

  const mediaUrl = normalizeRes?.url || normalizeRes?.normalized_url || streamUrl;

  // Post to all networks
  const results = {};
  for (const network of NETWORKS) {
    try {
      const res = await fetchJSON(`${MAJU_SERVER}/api/proxy/metricool/posts`, {
        method:  'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-metricool-token': token,
          'x-blog-id':         String(blogId),
        },
        body: JSON.stringify({
          text:     fullText,
          media:    mediaUrl,
          networks: [network],
          type:     'REEL',
        }),
      });
      results[network] = { ok: true, data: res };
      console.log(`  [publish] ${network} OK`);
    } catch (err) {
      results[network] = { ok: false, error: err.message };
      console.warn(`  [publish] ${network} failed: ${err.message}`);
    }
  }
  return results;
}

module.exports = { publish };
