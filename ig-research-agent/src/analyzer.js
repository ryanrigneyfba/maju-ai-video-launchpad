// IG Research Agent — Claude AI Analysis Engine
// Extracts hooks, detects patterns, and generates content briefs

const Anthropic = require('@anthropic-ai/sdk');
const config = require('./config');

let anthropic;

function getClient() {
  if (anthropic) return anthropic;
  if (!config.anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set. Get one at https://console.anthropic.com/settings/keys');
  }
  anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
  return anthropic;
}

// Extract hooks from high-performing posts
async function extractHooks(posts) {
  const client = getClient();
  const postSummaries = posts.map((p, i) => {
    return `Post ${i + 1} (@${p.owner_username || p.ownerUsername}, ${p.post_type || p.postType}, ` +
      `engagement: ${p.engagement_rate || p.engagementRate}%, ` +
      `likes: ${p.likes}, views: ${p.views || 0}):\n` +
      `"${(p.caption || '').slice(0, 500)}"`;
  }).join('\n\n');

  const response = await client.messages.create({
    model: config.claudeModel,
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: `You are an Instagram content strategist specializing in wellness/supplement brands.

Analyze these high-performing Instagram posts and extract the hooks (attention-grabbing opening lines or techniques).

${postSummaries}

For each post that has an identifiable hook, return a JSON array with objects containing:
- "postIndex": the post number (1-based)
- "hookText": the exact hook text or a description of the visual/audio hook
- "hookType": one of: question, statistic, controversy, transformation, fear, curiosity, social_proof, tutorial
- "hookPosition": "opening" (first line), "caption" (in body), or "visual" (thumbnail/first frame)
- "effectivenessScore": 1-10 based on the post's engagement relative to others
- "category": one of: health_claim, social_proof, educational, emotional, ugc, trend_jacking, myth_busting
- "whyItWorks": brief explanation of why this hook is effective

Return ONLY valid JSON. No markdown, no explanation outside the JSON.`
    }],
  });

  const text = response.content[0].text.trim();
  try {
    return JSON.parse(text);
  } catch {
    // Try to extract JSON from the response
    const match = text.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
    return [];
  }
}

// Detect content patterns across posts
async function detectPatterns(posts) {
  const client = getClient();

  // Prepare aggregated data
  const byType = {};
  const byUsername = {};
  posts.forEach(p => {
    const type = p.post_type || p.postType || 'unknown';
    const user = p.owner_username || p.ownerUsername || 'unknown';
    if (!byType[type]) byType[type] = { count: 0, totalEng: 0 };
    byType[type].count++;
    byType[type].totalEng += (p.engagement_rate || p.engagementRate || 0);
    if (!byUsername[user]) byUsername[user] = { count: 0, totalEng: 0 };
    byUsername[user].count++;
    byUsername[user].totalEng += (p.engagement_rate || p.engagementRate || 0);
  });

  const captions = posts
    .sort((a, b) => (b.engagement_rate || b.engagementRate || 0) - (a.engagement_rate || a.engagementRate || 0))
    .slice(0, 30)
    .map((p, i) => `${i + 1}. [@${p.owner_username || p.ownerUsername}] (${p.post_type || p.postType}, eng: ${p.engagement_rate || p.engagementRate}%) "${(p.caption || '').slice(0, 300)}"`)
    .join('\n');

  const response = await client.messages.create({
    model: config.claudeModel,
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: `You are an Instagram analytics expert for the wellness/supplement industry.

Analyze these top-performing posts and identify recurring content patterns.

Post type distribution: ${JSON.stringify(byType)}
Top accounts: ${JSON.stringify(byUsername)}

Top 30 posts by engagement:
${captions}

Identify patterns in these categories:
1. "format" — content formats that perform best (reels vs carousels vs static)
2. "topic" — themes/topics that drive engagement
3. "hook_style" — opening techniques that grab attention
4. "visual_style" — visual approaches mentioned or implied
5. "caption_style" — writing styles, lengths, emoji use, CTA patterns

Return a JSON array of pattern objects:
- "patternType": one of the categories above
- "patternName": short name for the pattern
- "description": 1-2 sentence description
- "frequency": how many of the top posts use this pattern
- "avgEngagementRate": estimated avg engagement of posts using this pattern

Return ONLY valid JSON. No markdown wrapping.`
    }],
  });

  const text = response.content[0].text.trim();
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
    return [];
  }
}

// Generate content briefs based on patterns and hooks
async function generateBriefs(hooks, patterns, competitorStats) {
  const client = getClient();

  const hookSummary = hooks.slice(0, 15).map(h =>
    `- [${h.hookType}] "${h.hookText}" (score: ${h.effectivenessScore})`
  ).join('\n');

  const patternSummary = patterns.slice(0, 10).map(p =>
    `- [${p.patternType}] ${p.patternName}: ${p.description} (eng: ${p.avgEngagementRate}%)`
  ).join('\n');

  const response = await client.messages.create({
    model: config.claudeModel,
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: `You are a content strategist for ${config.brandName}, a premium ${config.productCategory} brand on Instagram (@${config.brandHandle}).

Based on competitive research, generate 5 content briefs for the next week.

TOP HOOKS FOUND:
${hookSummary}

TOP PATTERNS:
${patternSummary}

COMPETITOR LANDSCAPE:
${JSON.stringify(competitorStats || [], null, 2)}

For each brief, return a JSON array with:
- "title": catchy working title
- "hook": the opening hook to use
- "format": "reel" | "carousel" | "story" | "static"
- "scriptOutline": array of 3-5 steps/scenes
- "visualDirection": brief visual style guidance
- "audioSuggestion": trending audio or music style
- "targetHashtags": array of 5-8 hashtags
- "priorityScore": 1-10 (10 = highest potential)
- "rationale": why this brief should perform well

Return ONLY valid JSON.`
    }],
  });

  const text = response.content[0].text.trim();
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
    return [];
  }
}

// Analyze a single post in depth
async function analyzePost(post) {
  const client = getClient();
  const response = await client.messages.create({
    model: config.claudeModel,
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `Analyze this Instagram post for a ${config.productCategory} brand research project.

Post by @${post.owner_username || post.ownerUsername}
Type: ${post.post_type || post.postType}
Likes: ${post.likes} | Comments: ${post.comments} | Views: ${post.views || 'N/A'} | Shares: ${post.shares || 'N/A'}
Engagement Rate: ${post.engagement_rate || post.engagementRate}%

Caption:
"${post.caption || ''}"

Provide analysis as JSON:
{
  "hookAnalysis": "what hook technique is used and why it works",
  "contentStructure": "how the content is structured",
  "emotionalTriggers": ["list of emotional triggers used"],
  "callToAction": "what CTA is used",
  "hashtagStrategy": "analysis of hashtag usage",
  "whatToSteal": "specific elements ${config.brandName} should adapt",
  "riskFactors": "any elements that could backfire for a wellness brand"
}

Return ONLY valid JSON.`
    }],
  });

  const text = response.content[0].text.trim();
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    return { error: 'Could not parse analysis' };
  }
}

module.exports = {
  extractHooks,
  detectPatterns,
  generateBriefs,
  analyzePost,
};
