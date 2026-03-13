/**
 * Metricool client — post to social networks via Metricool API v2.
 * Key field names: `text` (not content), `REEL` (not REELS), `media` as plain URL.
 */
const { request } = require('./http');
const { getKey } = require('../config');

function authHeaders() {
  return { 'x-api-key-value': getKey('metricoolApiKey') };
}

function metricoolParams() {
  return {
    blogId: getKey('metricoolBlogId'),
    userId: getKey('metricoolUserId'),
  };
}

/**
 * Get brands/accounts info.
 */
async function getBrands() {
  const { userId } = metricoolParams();
  const result = await request(
    `/api/proxy/metricool/brands?userId=${userId}`,
    'GET', authHeaders()
  );
  if (result.status !== 200) {
    throw new Error(`Metricool brands error ${result.status}: ${JSON.stringify(result.data).slice(0, 200)}`);
  }
  return result.data;
}

/**
 * Normalize a media URL for Metricool.
 */
async function normalizeMedia(mediaUrl) {
  const result = await request(
    `/api/proxy/metricool/normalize?url=${encodeURIComponent(mediaUrl)}`,
    'GET', authHeaders()
  );
  if (result.status !== 200) {
    throw new Error(`Metricool normalize error ${result.status}: ${JSON.stringify(result.data).slice(0, 200)}`);
  }
  return result.data;
}

/**
 * Create a scheduled post on Metricool.
 * @param {object} post - Post data
 * @param {string} post.text - Caption text
 * @param {string} post.media - Video URL (plain string)
 * @param {string} post.network - Network name (e.g. 'instagram', 'tiktok', 'youtube', 'facebook', 'twitter')
 * @param {string} post.type - Post type (e.g. 'REEL', 'VIDEO', 'POST')
 * @param {string} [post.date] - ISO date for scheduling (omit for immediate)
 */
async function createPost(post) {
  const { blogId, userId } = metricoolParams();
  const result = await request(
    `/api/proxy/metricool/posts?blogId=${blogId}&userId=${userId}`,
    'POST', authHeaders(), post
  );
  if (result.status !== 200 && result.status !== 201) {
    throw new Error(`Metricool post error ${result.status}: ${JSON.stringify(result.data).slice(0, 200)}`);
  }
  return result.data;
}

/**
 * Post to all Animal Stash networks.
 * @param {string} videoUrl - Public URL of the final video
 * @param {string} caption - Full caption with hashtags
 * @returns {Promise<object[]>} - Array of post results per network
 */
async function postToAllNetworks(videoUrl, caption) {
  const networks = [
    { network: 'instagram', type: 'REEL' },
    { network: 'tiktok',    type: 'VIDEO' },
    { network: 'youtube',   type: 'SHORT' },
    { network: 'facebook',  type: 'REEL' },
    { network: 'twitter',   type: 'VIDEO' },
  ];

  const results = [];
  for (const { network, type } of networks) {
    try {
      const result = await createPost({
        text: caption,
        media: videoUrl,
        network,
        type,
      });
      results.push({ network, success: true, data: result });
    } catch (e) {
      results.push({ network, success: false, error: e.message });
    }
  }

  return results;
}

module.exports = { getBrands, normalizeMedia, createPost, postToAllNetworks };
