// IG Research Agent — Apify Instagram Scraper Module
// Handles all Instagram data collection via Apify actors

const { ApifyClient } = require('apify-client');
const config = require('./config');

let client;

function getClient() {
  if (client) return client;
  if (!config.apifyToken) {
    throw new Error('APIFY_TOKEN is not set. Get one at https://console.apify.com/account/integrations');
  }
  client = new ApifyClient({ token: config.apifyToken });
  return client;
}

// Scrape posts from a specific Instagram profile
async function scrapeProfile(username, limit = config.postsPerAccount) {
  const apify = getClient();
  const run = await apify.actor(config.apifyActors.instagramScraper).call({
    directUrls: [`https://www.instagram.com/${username}/`],
    resultsType: 'posts',
    resultsLimit: limit,
    searchType: 'user',
  });

  const { items } = await apify.dataset(run.defaultDatasetId).listItems();
  return items.map(item => normalizePost(item, 'competitor', username));
}

// Scrape posts from a hashtag
async function scrapeHashtag(hashtag, limit = config.postsPerHashtag) {
  const apify = getClient();
  const tag = hashtag.replace(/^#/, '');
  const run = await apify.actor(config.apifyActors.instagramScraper).call({
    directUrls: [`https://www.instagram.com/explore/tags/${tag}/`],
    resultsType: 'posts',
    resultsLimit: limit,
    searchType: 'hashtag',
  });

  const { items } = await apify.dataset(run.defaultDatasetId).listItems();
  return items.map(item => normalizePost(item, 'hashtag', tag));
}

// Search Instagram for keyword-based content
async function scrapeSearch(keyword, limit = 30) {
  const apify = getClient();
  const run = await apify.actor(config.apifyActors.instagramSearchScraper).call({
    search: keyword,
    resultsLimit: limit,
    searchType: 'hashtag',
  });

  const { items } = await apify.dataset(run.defaultDatasetId).listItems();
  return items.map(item => normalizePost(item, 'search', keyword));
}

// Scrape reels specifically (includes share counts)
async function scrapeReels(username, limit = 20) {
  const apify = getClient();
  const run = await apify.actor(config.apifyActors.instagramReelScraper).call({
    usernames: [username],
    resultsLimit: limit,
  });

  const { items } = await apify.dataset(run.defaultDatasetId).listItems();
  return items.map(item => normalizePost(item, 'competitor', username));
}

// Scrape brand's own posts for performance tracking
async function scrapeBrandPosts(limit = config.postsPerAccount) {
  const apify = getClient();
  const run = await apify.actor(config.apifyActors.instagramScraper).call({
    directUrls: [`https://www.instagram.com/${config.brandHandle}/`],
    resultsType: 'posts',
    resultsLimit: limit,
    searchType: 'user',
  });

  const { items } = await apify.dataset(run.defaultDatasetId).listItems();
  return items.map(item => normalizePost(item, 'brand', config.brandHandle));
}

// Normalize Apify's varying output formats into our schema
function normalizePost(item, source, sourceQuery) {
  // Apify Instagram Scraper returns different field names depending on post type
  const caption = item.caption || item.text || '';
  const hashtags = extractHashtags(caption);

  // Determine post type
  let postType = 'image';
  if (item.type === 'Video' || item.videoUrl || item.isVideo) postType = 'video';
  if (item.type === 'Reel' || item.productType === 'clips') postType = 'reel';
  if (item.type === 'Sidecar' || item.childPosts) postType = 'carousel';

  const likes = item.likesCount || item.likes || 0;
  const comments = item.commentsCount || item.comments || 0;
  const views = item.videoViewCount || item.videoPlayCount || item.views || 0;
  const shares = item.sharesCount || item.shares || 0;

  // Calculate engagement rate
  const followerCount = item.ownerFollowerCount || item.followersCount || 1;
  const totalEngagement = likes + comments + (shares * 2); // weight shares higher
  const engagementRate = followerCount > 0
    ? (totalEngagement / followerCount) * 100
    : 0;

  return {
    igId: item.id || item.pk || `${source}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    shortcode: item.shortCode || item.shortcode || item.code || '',
    ownerUsername: item.ownerUsername || item.username || item.owner?.username || '',
    ownerId: item.ownerId || item.owner?.id || '',
    caption,
    postType,
    mediaUrl: item.displayUrl || item.thumbnailUrl || item.url || '',
    timestamp: item.timestamp || item.takenAtTimestamp
      ? new Date((item.timestamp || item.takenAtTimestamp) * 1000).toISOString()
      : new Date().toISOString(),
    likes,
    comments,
    shares,
    views,
    engagementRate: Math.round(engagementRate * 100) / 100,
    hashtags,
    source,
    sourceQuery,
  };
}

function extractHashtags(text) {
  if (!text) return [];
  const matches = text.match(/#[\w]+/g);
  return matches ? matches.map(h => h.toLowerCase()) : [];
}

module.exports = {
  scrapeProfile,
  scrapeHashtag,
  scrapeSearch,
  scrapeReels,
  scrapeBrandPosts,
  normalizePost,
};
