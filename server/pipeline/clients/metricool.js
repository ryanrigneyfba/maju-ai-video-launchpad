'use strict';

const { fetchJSON } = require('./http');
const { getKey, MAJU_SERVER } = require('../config');

// Metricool ScheduledPost field names per network
const NETWORK_FIELDS = {
  instagram: 'instagramPost',
  tiktok:    'tiktokPost',
  youtube:   'youtubePost',
  facebook:  'facebookPost',
  twitter:   'twitterPost',
};

async function publish(streamUrl, caption, hashtags) {
  const token  = getKey('metricoolToken');
  const blogId = getKey('metricoolBlogId');
  const text   = `${caption}\n\n${hashtags.map(h => `#${h}`).join(' ')}`;
  const media  = [{ url: streamUrl, type: 'VIDEO' }];

  // Post to each network individually with correct field structure
  const results = {};
  for (const [network, field] of Object.entries(NETWORK_FIELDS)) {
    try {
      const body = {
        [field]: { text, media, type: 'REEL' },
      };
      const res = await fetchJSON(
        `${MAJU_SERVER}/api/proxy/metricool/posts?blogId=${encodeURIComponent(blogId)}`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key-value': token },
          body:    JSON.stringify(body),
        },
      );
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
