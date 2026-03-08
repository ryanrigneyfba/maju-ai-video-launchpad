// IG Research Agent — Daily Research Cycle Orchestration
// Runs the full scrape → analyze → extract → brief pipeline

const config = require('./config');
const db = require('./db');
const scraper = require('./scraper');
const analyzer = require('./analyzer');

async function runFullCycle() {
  console.log('Starting research cycle...');
  db.getDb();
  const cycleId = db.startCycle();
  const stats = { accountsScraped: 0, hashtagsScraped: 0, postsFound: 0, hooksExtracted: 0 };

  try {
    // Phase 1: Scrape competitors
    console.log(`\nPhase 1: Scraping ${config.competitors.length} competitor accounts...`);
    const allPosts = [];

    for (const username of config.competitors) {
      console.log(`  Scraping @${username}...`);
      try {
        const posts = await scraper.scrapeProfile(username);
        for (const post of posts) {
          const result = db.upsertPost(post, cycleId);
          if (result.changes > 0) allPosts.push({ ...post, id: result.lastInsertRowid });
        }
        stats.accountsScraped++;
        console.log(`    Found ${posts.length} posts`);
      } catch (err) {
        console.error(`    Error scraping @${username}: ${err.message}`);
      }
    }

    // Phase 2: Scrape hashtags
    console.log(`\nPhase 2: Scraping ${config.hashtags.length} hashtags...`);
    for (const hashtag of config.hashtags) {
      console.log(`  Scraping #${hashtag}...`);
      try {
        const posts = await scraper.scrapeHashtag(hashtag);
        for (const post of posts) {
          const result = db.upsertPost(post, cycleId);
          if (result.changes > 0) allPosts.push({ ...post, id: result.lastInsertRowid });
        }
        stats.hashtagsScraped++;
        console.log(`    Found ${posts.length} posts`);
      } catch (err) {
        console.error(`    Error scraping #${hashtag}: ${err.message}`);
      }
    }

    // Phase 3: Scrape brand posts for performance tracking
    console.log(`\nPhase 3: Scraping brand @${config.brandHandle}...`);
    try {
      const brandPosts = await scraper.scrapeBrandPosts();
      for (const post of brandPosts) {
        db.upsertPost(post, cycleId);
      }
      console.log(`    Found ${brandPosts.length} brand posts`);
    } catch (err) {
      console.error(`    Error scraping brand: ${err.message}`);
    }

    stats.postsFound = allPosts.length;
    console.log(`\nTotal posts collected: ${stats.postsFound}`);

    // Phase 4: AI analysis on top-performing posts
    console.log('\nPhase 4: Extracting hooks from top posts...');
    const topPosts = db.getTopPosts({ limit: 30, minEngagement: config.minEngagementRate });

    if (topPosts.length > 0) {
      const hooks = await analyzer.extractHooks(topPosts);
      for (const hook of hooks) {
        const postIndex = hook.postIndex - 1;
        if (postIndex >= 0 && postIndex < topPosts.length) {
          db.insertHook({
            postId: topPosts[postIndex].id,
            hookText: hook.hookText,
            hookType: hook.hookType,
            hookPosition: hook.hookPosition || 'opening',
            effectivenessScore: hook.effectivenessScore || 5,
            category: hook.category || 'general',
          });
          stats.hooksExtracted++;
        }
      }
      console.log(`  Extracted ${stats.hooksExtracted} hooks`);
    }

    // Phase 5: Pattern detection
    console.log('\nPhase 5: Detecting content patterns...');
    const patterns = await analyzer.detectPatterns(topPosts);
    for (const pattern of patterns) {
      db.insertPattern(pattern, cycleId);
    }
    console.log(`  Found ${patterns.length} patterns`);

    // Phase 6: Generate content briefs
    console.log('\nPhase 6: Generating content briefs...');
    const storedHooks = db.getHooks({ limit: 15, minScore: 5 });
    const storedPatterns = db.getPatterns({ limit: 10 });
    const competitorStats = db.getCompetitorStats();

    const briefs = await analyzer.generateBriefs(storedHooks, storedPatterns, competitorStats);
    for (const brief of briefs) {
      db.insertBrief(brief, cycleId);
    }
    console.log(`  Generated ${briefs.length} content briefs`);

    // Complete cycle
    stats.summary = `Scraped ${stats.accountsScraped} accounts and ${stats.hashtagsScraped} hashtags. ` +
      `Found ${stats.postsFound} posts, extracted ${stats.hooksExtracted} hooks, ` +
      `detected ${patterns.length} patterns, generated ${briefs.length} content briefs.`;

    db.completeCycle(cycleId, stats);
    console.log(`\nResearch cycle #${cycleId} complete!`);
    console.log(stats.summary);

    return { cycleId, stats };
  } catch (err) {
    console.error(`\nResearch cycle failed: ${err.message}`);
    db.completeCycle(cycleId, { ...stats, summary: `Failed: ${err.message}` });
    throw err;
  }
}

module.exports = { runFullCycle };
