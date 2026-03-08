// IG Research Agent — SQLite Database Layer
// Stores scraped posts, analysis results, hooks, patterns, and research cycles

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('./config');

let db;

function getDb() {
  if (db) return db;

  const dir = path.dirname(config.dbPath);
  fs.mkdirSync(dir, { recursive: true });

  db = new Database(config.dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initSchema();
  return db;
}

function initSchema() {
  db.exec(`
    -- Research cycles (one per daily run)
    CREATE TABLE IF NOT EXISTS research_cycles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      status TEXT NOT NULL DEFAULT 'running',
      accounts_scraped INTEGER DEFAULT 0,
      hashtags_scraped INTEGER DEFAULT 0,
      posts_found INTEGER DEFAULT 0,
      hooks_extracted INTEGER DEFAULT 0,
      summary TEXT
    );

    -- Scraped Instagram posts
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ig_id TEXT UNIQUE,
      shortcode TEXT,
      owner_username TEXT,
      owner_id TEXT,
      caption TEXT,
      post_type TEXT,  -- image, video, reel, carousel
      media_url TEXT,
      timestamp TEXT,
      likes INTEGER DEFAULT 0,
      comments INTEGER DEFAULT 0,
      shares INTEGER DEFAULT 0,
      views INTEGER DEFAULT 0,
      engagement_rate REAL DEFAULT 0,
      hashtags TEXT,  -- JSON array
      source TEXT,  -- 'competitor', 'hashtag', 'search', 'brand'
      source_query TEXT,  -- which competitor/hashtag/keyword
      scraped_at TEXT NOT NULL DEFAULT (datetime('now')),
      cycle_id INTEGER REFERENCES research_cycles(id)
    );

    -- Extracted hooks from high-performing posts
    CREATE TABLE IF NOT EXISTS hooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER REFERENCES posts(id),
      hook_text TEXT NOT NULL,
      hook_type TEXT,  -- question, statistic, controversy, transformation, fear, curiosity
      hook_position TEXT DEFAULT 'opening',  -- opening, caption, comment
      effectiveness_score REAL,  -- 1-10 based on engagement of source post
      category TEXT,  -- health-claim, social-proof, educational, emotional, ugc
      extracted_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Content patterns detected across posts
    CREATE TABLE IF NOT EXISTS patterns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pattern_type TEXT NOT NULL,  -- format, topic, posting_time, visual_style, audio
      pattern_name TEXT NOT NULL,
      description TEXT,
      frequency INTEGER DEFAULT 1,
      avg_engagement_rate REAL,
      example_post_ids TEXT,  -- JSON array of post IDs
      first_seen TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen TEXT NOT NULL DEFAULT (datetime('now')),
      cycle_id INTEGER REFERENCES research_cycles(id)
    );

    -- Generated content briefs
    CREATE TABLE IF NOT EXISTS content_briefs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      hook TEXT,
      format TEXT,  -- reel, carousel, story, static
      script_outline TEXT,  -- JSON
      visual_direction TEXT,
      audio_suggestion TEXT,
      target_hashtags TEXT,  -- JSON array
      inspiration_post_ids TEXT,  -- JSON array of post IDs
      priority_score REAL,  -- 1-10
      status TEXT DEFAULT 'draft',  -- draft, approved, produced, posted
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      cycle_id INTEGER REFERENCES research_cycles(id)
    );

    -- Brand post performance tracking (for A/B learning)
    CREATE TABLE IF NOT EXISTS brand_performance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ig_id TEXT UNIQUE,
      shortcode TEXT,
      caption TEXT,
      post_type TEXT,
      hook_used TEXT,
      brief_id INTEGER REFERENCES content_briefs(id),
      posted_at TEXT,
      likes INTEGER DEFAULT 0,
      comments INTEGER DEFAULT 0,
      shares INTEGER DEFAULT 0,
      views INTEGER DEFAULT 0,
      engagement_rate REAL DEFAULT 0,
      saves INTEGER DEFAULT 0,
      reach INTEGER DEFAULT 0,
      tracked_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Indexes for fast queries
    CREATE INDEX IF NOT EXISTS idx_posts_username ON posts(owner_username);
    CREATE INDEX IF NOT EXISTS idx_posts_engagement ON posts(engagement_rate DESC);
    CREATE INDEX IF NOT EXISTS idx_posts_type ON posts(post_type);
    CREATE INDEX IF NOT EXISTS idx_posts_source ON posts(source, source_query);
    CREATE INDEX IF NOT EXISTS idx_hooks_type ON hooks(hook_type);
    CREATE INDEX IF NOT EXISTS idx_hooks_score ON hooks(effectiveness_score DESC);
    CREATE INDEX IF NOT EXISTS idx_patterns_type ON patterns(pattern_type);
    CREATE INDEX IF NOT EXISTS idx_briefs_priority ON content_briefs(priority_score DESC);
  `);
}

// --- Query helpers ---

function startCycle() {
  const stmt = db.prepare('INSERT INTO research_cycles (status) VALUES (?)');
  const result = stmt.run('running');
  return result.lastInsertRowid;
}

function completeCycle(cycleId, stats) {
  const stmt = db.prepare(`
    UPDATE research_cycles
    SET completed_at = datetime('now'),
        status = 'completed',
        accounts_scraped = ?,
        hashtags_scraped = ?,
        posts_found = ?,
        hooks_extracted = ?,
        summary = ?
    WHERE id = ?
  `);
  stmt.run(
    stats.accountsScraped || 0,
    stats.hashtagsScraped || 0,
    stats.postsFound || 0,
    stats.hooksExtracted || 0,
    stats.summary || '',
    cycleId
  );
}

function upsertPost(post, cycleId) {
  const stmt = db.prepare(`
    INSERT INTO posts (ig_id, shortcode, owner_username, owner_id, caption, post_type,
      media_url, timestamp, likes, comments, shares, views, engagement_rate,
      hashtags, source, source_query, cycle_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(ig_id) DO UPDATE SET
      likes = excluded.likes,
      comments = excluded.comments,
      shares = excluded.shares,
      views = excluded.views,
      engagement_rate = excluded.engagement_rate,
      scraped_at = datetime('now')
  `);
  return stmt.run(
    post.igId, post.shortcode, post.ownerUsername, post.ownerId,
    post.caption, post.postType, post.mediaUrl, post.timestamp,
    post.likes || 0, post.comments || 0, post.shares || 0, post.views || 0,
    post.engagementRate || 0, JSON.stringify(post.hashtags || []),
    post.source, post.sourceQuery, cycleId
  );
}

function insertHook(hook) {
  const stmt = db.prepare(`
    INSERT INTO hooks (post_id, hook_text, hook_type, hook_position, effectiveness_score, category)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  return stmt.run(
    hook.postId, hook.hookText, hook.hookType,
    hook.hookPosition || 'opening', hook.effectivenessScore || 0,
    hook.category || 'general'
  );
}

function insertPattern(pattern, cycleId) {
  const stmt = db.prepare(`
    INSERT INTO patterns (pattern_type, pattern_name, description, frequency,
      avg_engagement_rate, example_post_ids, cycle_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  return stmt.run(
    pattern.patternType, pattern.patternName, pattern.description || '',
    pattern.frequency || 1, pattern.avgEngagementRate || 0,
    JSON.stringify(pattern.examplePostIds || []), cycleId
  );
}

function insertBrief(brief, cycleId) {
  const stmt = db.prepare(`
    INSERT INTO content_briefs (title, hook, format, script_outline, visual_direction,
      audio_suggestion, target_hashtags, inspiration_post_ids, priority_score, cycle_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  return stmt.run(
    brief.title, brief.hook || '', brief.format || 'reel',
    JSON.stringify(brief.scriptOutline || []), brief.visualDirection || '',
    brief.audioSuggestion || '', JSON.stringify(brief.targetHashtags || []),
    JSON.stringify(brief.inspirationPostIds || []), brief.priorityScore || 5,
    cycleId
  );
}

// --- Read queries ---

function getTopPosts({ limit = 20, source, postType, minEngagement } = {}) {
  let sql = 'SELECT * FROM posts WHERE 1=1';
  const params = [];
  if (source) { sql += ' AND source = ?'; params.push(source); }
  if (postType) { sql += ' AND post_type = ?'; params.push(postType); }
  if (minEngagement) { sql += ' AND engagement_rate >= ?'; params.push(minEngagement); }
  sql += ' ORDER BY engagement_rate DESC LIMIT ?';
  params.push(limit);
  return db.prepare(sql).all(...params);
}

function getHooks({ limit = 20, hookType, minScore } = {}) {
  let sql = `
    SELECT h.*, p.caption, p.owner_username, p.engagement_rate as post_engagement,
           p.likes, p.views, p.post_type
    FROM hooks h
    JOIN posts p ON h.post_id = p.id
    WHERE 1=1
  `;
  const params = [];
  if (hookType) { sql += ' AND h.hook_type = ?'; params.push(hookType); }
  if (minScore) { sql += ' AND h.effectiveness_score >= ?'; params.push(minScore); }
  sql += ' ORDER BY h.effectiveness_score DESC LIMIT ?';
  params.push(limit);
  return db.prepare(sql).all(...params);
}

function getPatterns({ patternType, limit = 20 } = {}) {
  let sql = 'SELECT * FROM patterns WHERE 1=1';
  const params = [];
  if (patternType) { sql += ' AND pattern_type = ?'; params.push(patternType); }
  sql += ' ORDER BY avg_engagement_rate DESC LIMIT ?';
  params.push(limit);
  return db.prepare(sql).all(...params);
}

function getBriefs({ status, limit = 10 } = {}) {
  let sql = 'SELECT * FROM content_briefs WHERE 1=1';
  const params = [];
  if (status) { sql += ' AND status = ?'; params.push(status); }
  sql += ' ORDER BY priority_score DESC LIMIT ?';
  params.push(limit);
  return db.prepare(sql).all(...params);
}

function getCompetitorStats() {
  return db.prepare(`
    SELECT owner_username,
           COUNT(*) as total_posts,
           AVG(engagement_rate) as avg_engagement,
           MAX(engagement_rate) as max_engagement,
           AVG(likes) as avg_likes,
           AVG(comments) as avg_comments,
           AVG(views) as avg_views
    FROM posts
    WHERE source = 'competitor'
    GROUP BY owner_username
    ORDER BY avg_engagement DESC
  `).all();
}

function getRecentCycles(limit = 5) {
  return db.prepare(
    'SELECT * FROM research_cycles ORDER BY id DESC LIMIT ?'
  ).all(limit);
}

function getPostById(id) {
  return db.prepare('SELECT * FROM posts WHERE id = ?').get(id);
}

function getPostsByIds(ids) {
  const placeholders = ids.map(() => '?').join(',');
  return db.prepare(`SELECT * FROM posts WHERE id IN (${placeholders})`).all(...ids);
}

function close() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  getDb,
  startCycle,
  completeCycle,
  upsertPost,
  insertHook,
  insertPattern,
  insertBrief,
  getTopPosts,
  getHooks,
  getPatterns,
  getBriefs,
  getCompetitorStats,
  getRecentCycles,
  getPostById,
  getPostsByIds,
  close,
};
