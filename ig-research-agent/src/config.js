// IG Research Agent — Configuration
// Loads from environment variables with sensible defaults

const path = require('path');

const config = {
  // API keys
  apifyToken: process.env.APIFY_TOKEN || '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',

  // Brand info
  brandHandle: process.env.IG_BRAND_HANDLE || 'majublackseedoil',
  brandName: 'MAJU Black Seed Oil',
  productCategory: 'black seed oil / wellness supplements',

  // Competitors to monitor
  competitors: (process.env.IG_COMPETITORS || 'herbaldynamics,ancientnutrition,amazinggrass,gardenoflife')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),

  // Hashtags to track
  hashtags: (process.env.IG_HASHTAGS || 'blackseedoil,nigellasativa,naturalremedies,holistichealth,blackseedoilbenefits')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),

  // Scraping limits
  postsPerAccount: parseInt(process.env.POSTS_PER_ACCOUNT || '30', 10),
  postsPerHashtag: parseInt(process.env.POSTS_PER_HASHTAG || '50', 10),
  minEngagementRate: parseFloat(process.env.MIN_ENGAGEMENT_RATE || '2.0'),

  // Database
  dbPath: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'research.db'),

  // Apify actor IDs
  apifyActors: {
    instagramScraper: 'apify/instagram-scraper',
    instagramReelScraper: 'apify/instagram-reel-scraper',
    instagramSearchScraper: 'apify/instagram-search-scraper',
  },

  // Claude model for analysis
  claudeModel: 'claude-sonnet-4-20250514',
};

module.exports = config;
