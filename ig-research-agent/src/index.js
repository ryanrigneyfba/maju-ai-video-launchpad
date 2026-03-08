#!/usr/bin/env node

// IG Research Agent — MCP Server
// Exposes Instagram research tools via Model Context Protocol

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

const db = require('./db');
const scraper = require('./scraper');
const analyzer = require('./analyzer');
const { runFullCycle } = require('./research-cycle');
const config = require('./config');

const server = new Server(
  { name: 'ig-research-agent', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// --- Tool Definitions ---

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'run_research_cycle',
      description: 'Run a full daily research cycle: scrape competitors + hashtags, extract hooks, detect patterns, generate content briefs. Takes 5-10 minutes.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'scrape_profile',
      description: 'Scrape recent posts from a specific Instagram profile',
      inputSchema: {
        type: 'object',
        properties: {
          username: { type: 'string', description: 'Instagram username (without @)' },
          limit: { type: 'number', description: 'Max posts to scrape (default 30)' },
        },
        required: ['username'],
      },
    },
    {
      name: 'scrape_hashtag',
      description: 'Scrape top posts from an Instagram hashtag',
      inputSchema: {
        type: 'object',
        properties: {
          hashtag: { type: 'string', description: 'Hashtag to scrape (without #)' },
          limit: { type: 'number', description: 'Max posts to scrape (default 50)' },
        },
        required: ['hashtag'],
      },
    },
    {
      name: 'get_top_posts',
      description: 'Get top-performing posts from the research database, sorted by engagement rate',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Number of posts (default 20)' },
          source: { type: 'string', enum: ['competitor', 'hashtag', 'search', 'brand'] },
          post_type: { type: 'string', enum: ['image', 'video', 'reel', 'carousel'] },
          min_engagement: { type: 'number', description: 'Minimum engagement rate %' },
        },
      },
    },
    {
      name: 'get_hooks',
      description: 'Get extracted hooks from high-performing posts, ranked by effectiveness',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Number of hooks (default 20)' },
          hook_type: {
            type: 'string',
            enum: ['question', 'statistic', 'controversy', 'transformation', 'fear', 'curiosity', 'social_proof', 'tutorial'],
          },
          min_score: { type: 'number', description: 'Minimum effectiveness score (1-10)' },
        },
      },
    },
    {
      name: 'get_patterns',
      description: 'Get detected content patterns across competitor posts',
      inputSchema: {
        type: 'object',
        properties: {
          pattern_type: {
            type: 'string',
            enum: ['format', 'topic', 'hook_style', 'visual_style', 'caption_style'],
          },
          limit: { type: 'number', description: 'Number of patterns (default 20)' },
        },
      },
    },
    {
      name: 'get_content_briefs',
      description: 'Get AI-generated content briefs based on research findings',
      inputSchema: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['draft', 'approved', 'produced', 'posted'] },
          limit: { type: 'number', description: 'Number of briefs (default 10)' },
        },
      },
    },
    {
      name: 'get_competitor_stats',
      description: 'Get aggregated engagement statistics for all monitored competitor accounts',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'analyze_post',
      description: 'Run deep AI analysis on a specific post by ID — hooks, structure, emotional triggers, what to steal',
      inputSchema: {
        type: 'object',
        properties: {
          post_id: { type: 'number', description: 'Database post ID' },
        },
        required: ['post_id'],
      },
    },
    {
      name: 'generate_briefs',
      description: 'Generate new content briefs from current hooks and patterns in the database',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'get_research_status',
      description: 'Get status of recent research cycles and overall database stats',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'get_dashboard_data',
      description: 'Get bird\'s-eye dashboard data across IG Research Agent — cycle history, top hooks, patterns, briefs, competitor landscape',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
  ],
}));

// --- Tool Handlers ---

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  db.getDb();

  try {
    switch (name) {
      case 'run_research_cycle': {
        const result = await runFullCycle();
        return toolResult(`Research cycle #${result.cycleId} complete.\n${result.stats.summary}`);
      }

      case 'scrape_profile': {
        const posts = await scraper.scrapeProfile(args.username, args.limit);
        const cycleId = db.startCycle();
        let saved = 0;
        for (const post of posts) {
          const r = db.upsertPost(post, cycleId);
          if (r.changes > 0) saved++;
        }
        db.completeCycle(cycleId, {
          accountsScraped: 1, postsFound: saved,
          summary: `Scraped @${args.username}: ${posts.length} posts found, ${saved} saved`
        });
        return toolResult(`Scraped @${args.username}: ${posts.length} posts found, ${saved} new/updated in database.`);
      }

      case 'scrape_hashtag': {
        const posts = await scraper.scrapeHashtag(args.hashtag, args.limit);
        const cycleId = db.startCycle();
        let saved = 0;
        for (const post of posts) {
          const r = db.upsertPost(post, cycleId);
          if (r.changes > 0) saved++;
        }
        db.completeCycle(cycleId, {
          hashtagsScraped: 1, postsFound: saved,
          summary: `Scraped #${args.hashtag}: ${posts.length} posts found, ${saved} saved`
        });
        return toolResult(`Scraped #${args.hashtag}: ${posts.length} posts found, ${saved} new/updated in database.`);
      }

      case 'get_top_posts': {
        const posts = db.getTopPosts({
          limit: args.limit, source: args.source,
          postType: args.post_type, minEngagement: args.min_engagement,
        });
        return toolResult(JSON.stringify(posts, null, 2));
      }

      case 'get_hooks': {
        const hooks = db.getHooks({
          limit: args.limit, hookType: args.hook_type, minScore: args.min_score,
        });
        return toolResult(JSON.stringify(hooks, null, 2));
      }

      case 'get_patterns': {
        const patterns = db.getPatterns({
          patternType: args.pattern_type, limit: args.limit,
        });
        return toolResult(JSON.stringify(patterns, null, 2));
      }

      case 'get_content_briefs': {
        const briefs = db.getBriefs({ status: args.status, limit: args.limit });
        return toolResult(JSON.stringify(briefs, null, 2));
      }

      case 'get_competitor_stats': {
        const stats = db.getCompetitorStats();
        return toolResult(JSON.stringify(stats, null, 2));
      }

      case 'analyze_post': {
        const post = db.getPostById(args.post_id);
        if (!post) return toolResult('Post not found with that ID.');
        const analysis = await analyzer.analyzePost(post);
        return toolResult(JSON.stringify({ post, analysis }, null, 2));
      }

      case 'generate_briefs': {
        const hooks = db.getHooks({ limit: 15, minScore: 5 });
        const patterns = db.getPatterns({ limit: 10 });
        const competitorStats = db.getCompetitorStats();
        const briefs = await analyzer.generateBriefs(hooks, patterns, competitorStats);
        const cycleId = db.startCycle();
        for (const brief of briefs) {
          db.insertBrief(brief, cycleId);
        }
        db.completeCycle(cycleId, {
          summary: `Generated ${briefs.length} new content briefs`
        });
        return toolResult(JSON.stringify(briefs, null, 2));
      }

      case 'get_research_status': {
        const cycles = db.getRecentCycles(5);
        const d = db.getDb();
        const postCount = d.prepare('SELECT COUNT(*) as count FROM posts').get();
        const hookCount = d.prepare('SELECT COUNT(*) as count FROM hooks').get();
        const patternCount = d.prepare('SELECT COUNT(*) as count FROM patterns').get();
        const briefCount = d.prepare('SELECT COUNT(*) as count FROM content_briefs').get();
        return toolResult(JSON.stringify({
          database: {
            totalPosts: postCount.count,
            totalHooks: hookCount.count,
            totalPatterns: patternCount.count,
            totalBriefs: briefCount.count,
          },
          recentCycles: cycles,
          config: {
            competitors: config.competitors,
            hashtags: config.hashtags,
            brandHandle: config.brandHandle,
          },
        }, null, 2));
      }

      case 'get_dashboard_data': {
        const d = db.getDb();
        const postCount = d.prepare('SELECT COUNT(*) as count FROM posts').get();
        const hookCount = d.prepare('SELECT COUNT(*) as count FROM hooks').get();
        const patternCount = d.prepare('SELECT COUNT(*) as count FROM patterns').get();
        const briefCount = d.prepare('SELECT COUNT(*) as count FROM content_briefs').get();
        const cycles = db.getRecentCycles(10);
        const topHooks = db.getHooks({ limit: 5, minScore: 7 });
        const topPatterns = db.getPatterns({ limit: 5 });
        const topBriefs = db.getBriefs({ status: 'draft', limit: 5 });
        const competitors = db.getCompetitorStats();
        const topPosts = db.getTopPosts({ limit: 5 });

        return toolResult(JSON.stringify({
          overview: {
            totalPosts: postCount.count,
            totalHooks: hookCount.count,
            totalPatterns: patternCount.count,
            totalBriefs: briefCount.count,
            totalCycles: cycles.length,
            lastCycle: cycles[0] || null,
          },
          topHooks,
          topPatterns,
          pendingBriefs: topBriefs,
          competitorLandscape: competitors,
          topPosts,
          config: {
            competitors: config.competitors,
            hashtags: config.hashtags,
            brandHandle: config.brandHandle,
          },
        }, null, 2));
      }

      default:
        return toolResult(`Unknown tool: ${name}`);
    }
  } catch (err) {
    return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
  }
});

function toolResult(text) {
  return { content: [{ type: 'text', text }] };
}

// --- Start Server ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('IG Research Agent MCP server running on stdio');
}

main().catch(err => {
  console.error('Failed to start MCP server:', err);
  process.exit(1);
});
