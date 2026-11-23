export interface ApifyFetchedMetadata {
  title: string;
  description: string;
  author: string;
  views: number;
  likes: number;
  comments: number;
  hashtags: string[];
  publishedDate: string;
  sampleComments: string[];
  directMediaUrl?: string;
}

function getApifyToken(): string {
  return (process.env.APIFY_API_TOKEN || '').trim();
}

export function isApifyConfigured(): boolean {
  const token = getApifyToken();
  return Boolean(token && token.length > 10);
}

function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\p{L}\p{N}_]+/gu);
  return matches ? Array.from(new Set(matches)) : [];
}

function toSafeNumber(val: unknown): number {
  if (typeof val === 'number' && Number.isFinite(val)) return Math.max(0, val);
  if (typeof val === 'string') {
    const cleaned = val.replace(/[^0-9.]/g, '');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }
  return 0;
}

async function runApifyActorSync(
  actorId: string,
  input: Record<string, any>,
  options?: { memoryMb?: number; timeoutSecs?: number }
): Promise<any[] | null> {
  const token = getApifyToken();
  if (!token) return null;

  const memory = options?.memoryMb ?? 256;
  const timeout = options?.timeoutSecs ?? 45;
  const endpoint = `https://api.apify.com/v2/acts/${encodeURIComponent(
    actorId
  )}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&memory=${memory}&timeout=${timeout}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), (timeout + 5) * 1000);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(`[ApifyService] Actor ${actorId} failed HTTP ${res.status}: ${errText.slice(0, 160)}`);
      return null;
    }

    const items = await res.json();
    return Array.isArray(items) ? items : null;
  } catch (err: any) {
    console.warn(`[ApifyService] Actor ${actorId} request error:`, err?.message || err);
    return null;
  }
}

function collectCommentTexts(rawList: any): string[] {
  if (!Array.isArray(rawList)) return [];
  return rawList
    .map((c: any) => {
      if (typeof c === 'string') return c.trim();
      return String(c?.text || c?.commentText || c?.message || c?.content || '').trim();
    })
    .filter(Boolean)
    .slice(0, 6);
}

async function fetchTikTokViaApify(rawUrl: string): Promise<ApifyFetchedMetadata | null> {
  const actorId = process.env.APIFY_TIKTOK_ACTOR?.trim() || 'clockworks~tiktok-scraper';
  const items = await runApifyActorSync(
    actorId,
    {
      postURLs: [rawUrl],
      resultsPerPage: 1,
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
      commentsPerPost: 6,
    },
    { memoryMb: 256, timeoutSecs: 45 }
  );

  const item = items?.[0];
  if (!item || item.error) return null;

  const caption = String(item.text || item.desc || item.title || '').trim();
  const views = toSafeNumber(item.playCount ?? item.views ?? item.stats?.playCount);
  const likes = toSafeNumber(item.diggCount ?? item.likes ?? item.stats?.diggCount);
  const comments = toSafeNumber(item.commentCount ?? item.comments ?? item.stats?.commentCount);
  const author = String(item.authorMeta?.nickName || item.authorMeta?.name || item.author || 'TikTok Creator');
  const publishedDate = item.createTimeISO
    ? String(item.createTimeISO)
    : typeof item.createTime === 'number'
      ? new Date(item.createTime * 1000).toISOString()
      : new Date().toISOString();

  const directMediaUrl =
    (typeof item.videoMeta?.downloadAddr === 'string' && item.videoMeta.downloadAddr.startsWith('http')
      ? item.videoMeta.downloadAddr
      : undefined) ||
    (Array.isArray(item.mediaUrls) && typeof item.mediaUrls[0] === 'string' && item.mediaUrls[0].startsWith('http')
      ? item.mediaUrls[0]
      : undefined);

  let sampleComments = collectCommentTexts(item.comments || item.topComments);

  // Only fetch comments via separate actor if post had comments > 0 and none were returned inline
  if (sampleComments.length === 0 && comments > 0 && process.env.APIFY_FETCH_TIKTOK_COMMENTS !== 'false') {
    const commentActor = process.env.APIFY_TIKTOK_COMMENTS_ACTOR?.trim() || 'clockworks~tiktok-comments-scraper';
    const commentItems = await runApifyActorSync(
      commentActor,
      {
        postURLs: [rawUrl],
        commentsPerPost: 5,
        maxRepliesPerComment: 0,
      },
      { memoryMb: 256, timeoutSecs: 30 }
    );
    if (commentItems && commentItems.length > 0) {
      sampleComments = collectCommentTexts(commentItems);
    }
  }

  const hashtags = Array.from(
    new Set([
      ...extractHashtags(caption),
      ...(Array.isArray(item.hashtags) ? item.hashtags.map((h: any) => `#${String(h?.name || h).replace(/^#/, '')}`) : []),
    ])
  );

  return {
    title: caption.split('\n')[0]?.slice(0, 140) || 'TikTok Video',
    description: caption,
    author,
    views,
    likes,
    comments,
    hashtags,
    publishedDate,
    sampleComments,
    directMediaUrl,
  };
}

async function fetchInstagramViaApify(rawUrl: string): Promise<ApifyFetchedMetadata | null> {
  const actorId = process.env.APIFY_INSTAGRAM_ACTOR?.trim() || 'apify~instagram-scraper';
  const items = await runApifyActorSync(
    actorId,
    {
      directUrls: [rawUrl],
      resultsType: 'posts',
      resultsLimit: 1,
    },
    { memoryMb: 256, timeoutSecs: 45 }
  );

  const item = items?.[0];
  if (!item || item.error) return null;

  const caption = String(item.caption || item.title || '').trim();
  const views = toSafeNumber(item.videoViewCount ?? item.videoPlayCount ?? item.playCount ?? item.viewsCount);
  const likes = toSafeNumber(item.likesCount ?? item.likes);
  const comments = toSafeNumber(item.commentsCount ?? item.comments);
  const author = String(item.ownerFullName || item.ownerUsername || 'Instagram Creator');
  const publishedDate = item.timestamp ? String(item.timestamp) : new Date().toISOString();

  const directMediaUrl =
    typeof item.videoUrl === 'string' && item.videoUrl.startsWith('http') ? item.videoUrl : undefined;

  const sampleComments = collectCommentTexts(item.latestComments || item.commentsData);
  const hashtags = Array.from(
    new Set([
      ...extractHashtags(caption),
      ...(Array.isArray(item.hashtags) ? item.hashtags.map((h: any) => `#${String(h).replace(/^#/, '')}`) : []),
    ])
  );

  return {
    title: caption.split('\n')[0]?.slice(0, 140) || 'Instagram Reel',
    description: caption,
    author,
    views,
    likes,
    comments,
    hashtags,
    publishedDate,
    sampleComments,
    directMediaUrl,
  };
}

async function fetchFacebookViaApify(rawUrl: string): Promise<ApifyFetchedMetadata | null> {
  const actorId = process.env.APIFY_FACEBOOK_ACTOR?.trim() || 'apify~facebook-posts-scraper';
  const items = await runApifyActorSync(
    actorId,
    {
      startUrls: [{ url: rawUrl }],
      resultsLimit: 1,
      captionText: true,
    },
    { memoryMb: 256, timeoutSecs: 45 }
  );

  const item = items?.[0];
  if (!item || item.error) return null;

  const caption = String(item.text || item.message || item.title || '').trim();
  const views = toSafeNumber(item.viewsCount ?? item.videoViewCount ?? item.playsCount ?? item.views);
  const likes = toSafeNumber(item.likes ?? item.likesCount ?? item.reactionsCount);
  const comments = toSafeNumber(item.comments ?? item.commentsCount);
  const author = String(item.pageName || item.user?.name || item.author || 'Facebook Creator');
  const publishedDate = item.time ? String(item.time) : new Date().toISOString();

  const directMediaUrl =
    (typeof item.videoUrl === 'string' && item.videoUrl.startsWith('http') ? item.videoUrl : undefined) ||
    (Array.isArray(item.media) && typeof item.media[0]?.playable_url === 'string'
      ? item.media[0].playable_url
      : undefined) ||
    (Array.isArray(item.media) && typeof item.media[0]?.videoUrl === 'string' ? item.media[0].videoUrl : undefined);

  let sampleComments = collectCommentTexts(item.topComments || item.commentsList);

  if (sampleComments.length === 0 && comments > 0 && process.env.APIFY_FETCH_FACEBOOK_COMMENTS !== 'false') {
    const commentActor = process.env.APIFY_FACEBOOK_COMMENTS_ACTOR?.trim() || 'apify~facebook-comments-scraper';
    const commentItems = await runApifyActorSync(
      commentActor,
      {
        startUrls: [{ url: rawUrl }],
        resultsLimit: 5,
      },
      { memoryMb: 256, timeoutSecs: 30 }
    );
    if (commentItems && commentItems.length > 0) {
      sampleComments = collectCommentTexts(commentItems);
    }
  }

  return {
    title: caption.split('\n')[0]?.slice(0, 140) || 'Facebook Reel / Video',
    description: caption,
    author,
    views,
    likes,
    comments,
    hashtags: extractHashtags(caption),
    publishedDate,
    sampleComments,
    directMediaUrl,
  };
}

export async function fetchApifyVideoMetadata(
  rawUrl: string,
  platform: 'facebook_reels' | 'tiktok' | 'instagram'
): Promise<ApifyFetchedMetadata | null> {
  if (!isApifyConfigured()) return null;

  if (platform === 'tiktok') return fetchTikTokViaApify(rawUrl);
  if (platform === 'instagram') return fetchInstagramViaApify(rawUrl);
  if (platform === 'facebook_reels') return fetchFacebookViaApify(rawUrl);
  return null;
}
