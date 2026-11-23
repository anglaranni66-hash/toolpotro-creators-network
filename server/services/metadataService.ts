import { execFile } from 'child_process';
import { promisify } from 'util';
import { fetchApifyVideoMetadata, isApifyConfigured } from './apifyService.js';

const execFileAsync = promisify(execFile);

export interface VideoMetadata {
  platform: 'youtube_shorts' | 'facebook_reels' | 'tiktok' | 'instagram';
  videoId: string;
  normalizedUrl: string;
  title: string;
  author: string;
  views: number;
  likes: number;
  comments: number;
  likeRatio: number;
  commentRatio: number;
  description: string;
  hashtags: string[];
  publishedDate: string;
  daysSincePublished: number;
  isWithin7DaysWindow: boolean;
  hasBrandLink: boolean;
  pinnedCommentSample?: string;
  sampleComments: string[];
  organicReachScore: number;
  hasLiveMetrics: boolean;
  hasLiveText: boolean;
  directMediaUrl?: string;
  fetchSource: 'youtube_data_api' | 'apify' | 'yt_dlp' | 'oembed_partial' | 'unavailable';
  fetchError?: string;
}

/**
 * Strips tracking parameters (utm_*, fbclid, si, etc.) to normalize video URLs for deduplication.
 */
export function normalizeVideoUrl(rawUrl: string): {
  normalizedUrl: string;
  platform: 'youtube_shorts' | 'facebook_reels' | 'tiktok' | 'instagram';
  videoId: string;
} {
  const urlObj = new URL(rawUrl.trim());
  const host = urlObj.hostname.toLowerCase();

  const trackingParams = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'fbclid',
    'si',
    'igshid',
    'feature',
    'app',
    'is_from_webapp',
    'sender_device',
  ];
  trackingParams.forEach((param) => urlObj.searchParams.delete(param));

  let platform: 'youtube_shorts' | 'facebook_reels' | 'tiktok' | 'instagram' = 'youtube_shorts';
  let videoId = '';

  if (host.includes('youtube.com') || host.includes('youtu.be')) {
    platform = 'youtube_shorts';
    if (urlObj.pathname.includes('/shorts/')) {
      videoId = urlObj.pathname.split('/shorts/')[1].split('/')[0].split('?')[0];
      urlObj.pathname = `/shorts/${videoId}`;
    } else if (urlObj.searchParams.get('v')) {
      videoId = urlObj.searchParams.get('v')!;
      urlObj.pathname = `/watch`;
      urlObj.search = `?v=${videoId}`;
    } else {
      videoId = urlObj.pathname.replace(/^\//, '').split('/')[0];
      urlObj.pathname = `/watch`;
      urlObj.search = `?v=${videoId}`;
    }
  } else if (host.includes('facebook.com') || host.includes('fb.watch') || host.includes('fb.gg')) {
    platform = 'facebook_reels';
    const match = urlObj.pathname.match(/\/(reel|reels|videos|watch)\/([0-9a-zA-Z_\-]+)/);
    if (match) {
      videoId = match[2];
    } else {
      videoId = urlObj.pathname.replace(/[^0-9a-zA-Z]/g, '').slice(-14) || `fb_${Date.now()}`;
    }
    urlObj.pathname = `/reel/${videoId}`;
    urlObj.search = '';
  } else if (host.includes('tiktok.com')) {
    platform = 'tiktok';
    const match = urlObj.pathname.match(/\/video\/([0-9]+)/);
    if (match) {
      videoId = match[1];
    } else {
      videoId = urlObj.pathname.replace(/[^0-9]/g, '') || `tt_${Date.now()}`;
    }
    urlObj.pathname = `/video/${videoId}`;
    urlObj.search = '';
  } else if (host.includes('instagram.com')) {
    platform = 'instagram';
    const match = urlObj.pathname.match(/\/(reel|reels|p|tv)\/([0-9a-zA-Z_\-]+)/);
    if (match) {
      videoId = match[2];
    } else {
      videoId = urlObj.pathname.replace(/[^0-9a-zA-Z_\-]/g, '').slice(-14) || `ig_${Date.now()}`;
    }
    urlObj.pathname = `/reel/${videoId}`;
    urlObj.search = '';
  }

  return {
    normalizedUrl: urlObj.toString(),
    platform,
    videoId: videoId || `vid_${Math.random().toString(36).substring(2, 9)}`,
  };
}

function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\p{L}\p{N}_]+/gu);
  return matches ? Array.from(new Set(matches)) : [];
}

function checkLinkPresence(text: string, expectedLinkUrl?: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  if (!expectedLinkUrl) return lower.includes('http');
  try {
    const parsed = new URL(expectedLinkUrl.startsWith('http') ? expectedLinkUrl : `https://${expectedLinkUrl}`);
    const cleanHost = parsed.hostname.replace(/^www\./, '').toLowerCase();
    return lower.includes(cleanHost);
  } catch {
    return lower.includes(expectedLinkUrl.toLowerCase());
  }
}

async function fetchYouTubeApiMetadata(
  videoId: string,
  normalizedUrl: string,
  expectedLinkUrl?: string
): Promise<VideoMetadata | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey || !videoId) return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const endpoint = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${encodeURIComponent(
      videoId
    )}&key=${encodeURIComponent(apiKey)}`;

    const res = await fetch(endpoint, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      console.warn(`[MetadataService] YouTube API HTTP ${res.status}`);
      return null;
    }

    const data: any = await res.json();
    const item = data?.items?.[0];
    if (!item) return null;

    const snippet = item.snippet || {};
    const stats = item.statistics || {};

    const title = String(snippet.title || '');
    const description = String(snippet.description || '');
    const author = String(snippet.channelTitle || 'YouTube Creator');
    const publishedDate = String(snippet.publishedAt || new Date().toISOString());
    const daysOld = Math.max(
      0,
      Math.floor((Date.now() - new Date(publishedDate).getTime()) / (1000 * 60 * 60 * 24))
    );

    const views = Number(stats.viewCount || 0);
    const likes = Number(stats.likeCount || 0);
    const comments = Number(stats.commentCount || 0);
    const likeRatio = views > 0 ? Number((likes / views).toFixed(4)) : 0;
    const commentRatio = views > 0 ? Number((comments / views).toFixed(4)) : 0;

    const tagsFromApi = Array.isArray(snippet.tags) ? snippet.tags : [];
    const hashtags = Array.from(new Set([...extractHashtags(`${title} ${description}`), ...tagsFromApi.map((t: string) => `#${t}`)]));

    // Try fetching top comments if available
    let sampleComments: string[] = [];
    try {
      const cCtrl = new AbortController();
      const cTimer = setTimeout(() => cCtrl.abort(), 4500);
      const cRes = await fetch(
        `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${encodeURIComponent(
          videoId
        )}&maxResults=5&order=relevance&key=${encodeURIComponent(apiKey)}`,
        { signal: cCtrl.signal }
      );
      clearTimeout(cTimer);
      if (cRes.ok) {
        const cData: any = await cRes.json();
        if (Array.isArray(cData?.items)) {
          sampleComments = cData.items
            .map((c: any) => c?.snippet?.topLevelComment?.snippet?.textOriginal || '')
            .filter(Boolean)
            .slice(0, 5);
        }
      }
    } catch {
      // comments might be disabled
    }

    const combinedText = `${title}\n${description}\n${sampleComments.join('\n')}`;
    const hasBrandLink = checkLinkPresence(combinedText, expectedLinkUrl);

    return {
      platform: 'youtube_shorts',
      videoId,
      normalizedUrl,
      title,
      author,
      views,
      likes,
      comments,
      likeRatio,
      commentRatio,
      description,
      hashtags,
      publishedDate,
      daysSincePublished: daysOld,
      isWithin7DaysWindow: daysOld <= 7,
      hasBrandLink,
      sampleComments,
      organicReachScore: Math.min(99, Math.max(30, Math.round(60 + likeRatio * 400))),
      hasLiveMetrics: true,
      hasLiveText: true,
      fetchSource: 'youtube_data_api',
    };
  } catch (err: any) {
    console.warn('[MetadataService] YouTube API error:', err?.message || err);
    return null;
  }
}

async function fetchWithYtDlp(
  rawUrl: string,
  platform: VideoMetadata['platform'],
  videoId: string,
  normalizedUrl: string,
  expectedLinkUrl?: string
): Promise<VideoMetadata | null> {
  try {
    const { stdout } = await execFileAsync(
      'yt-dlp',
      ['--dump-single-json', '--no-warnings', '--no-playlist', '--skip-download', rawUrl],
      { timeout: 15000, maxBuffer: 5 * 1024 * 1024 }
    );
    const info = JSON.parse(stdout);
    const title = String(info.title || info.fulltitle || '');
    const description = String(info.description || '');
    const author = String(info.uploader || info.channel || info.creator || '');

    const uploadDateRaw = String(info.upload_date || '');
    let publishedDate = new Date().toISOString();
    if (/^\d{8}$/.test(uploadDateRaw)) {
      const y = uploadDateRaw.slice(0, 4);
      const m = uploadDateRaw.slice(4, 6);
      const d = uploadDateRaw.slice(6, 8);
      publishedDate = new Date(`${y}-${m}-${d}T00:00:00Z`).toISOString();
    } else if (typeof info.timestamp === 'number') {
      publishedDate = new Date(info.timestamp * 1000).toISOString();
    }

    const daysOld = Math.max(
      0,
      Math.floor((Date.now() - new Date(publishedDate).getTime()) / (1000 * 60 * 60 * 24))
    );

    const views = typeof info.view_count === 'number' ? info.view_count : 0;
    const likes = typeof info.like_count === 'number' ? info.like_count : 0;
    const comments = typeof info.comment_count === 'number' ? info.comment_count : 0;
    const hasLiveMetrics = typeof info.view_count === 'number';

    const likeRatio = views > 0 ? Number((likes / views).toFixed(4)) : 0;
    const commentRatio = views > 0 ? Number((comments / views).toFixed(4)) : 0;

    const tags = Array.isArray(info.tags) ? info.tags : [];
    const hashtags = Array.from(
      new Set([...extractHashtags(`${title} ${description}`), ...tags.map((t: string) => `#${t}`)])
    );

    const sampleComments = Array.isArray(info.comments)
      ? info.comments.slice(0, 5).map((c: any) => String(c?.text || '')).filter(Boolean)
      : [];

    const hasBrandLink = checkLinkPresence(`${title}\n${description}\n${sampleComments.join('\n')}`, expectedLinkUrl);

    return {
      platform,
      videoId,
      normalizedUrl,
      title,
      author,
      views,
      likes,
      comments,
      likeRatio,
      commentRatio,
      description,
      hashtags,
      publishedDate,
      daysSincePublished: daysOld,
      isWithin7DaysWindow: daysOld <= 7,
      hasBrandLink,
      sampleComments,
      organicReachScore: hasLiveMetrics ? Math.min(99, Math.max(40, Math.round(60 + likeRatio * 400))) : 0,
      hasLiveMetrics,
      hasLiveText: Boolean(title || description),
      fetchSource: 'yt_dlp',
    };
  } catch (err: any) {
    // yt-dlp might not be installed or platform blocked unauthenticated request
    return null;
  }
}

async function fetchOEmbedTitle(
  rawUrl: string,
  platform: VideoMetadata['platform']
): Promise<{ title: string; author: string } | null> {
  try {
    let endpoint = '';
    if (platform === 'youtube_shorts') {
      endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(rawUrl)}&format=json`;
    } else if (platform === 'tiktok') {
      endpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(rawUrl)}`;
    }
    if (!endpoint) return null;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(endpoint, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data: any = await res.json();
    return {
      title: String(data?.title || ''),
      author: String(data?.author_name || ''),
    };
  } catch {
    return null;
  }
}

/**
 * Fetches genuine public engagement metrics & caption/description.
 * NEVER fabricates views/likes/comments: if live stats cannot be retrieved, marks hasLiveMetrics=false
 * so the pipeline routes the submission to Admin "ম্যানুয়ালি যাচাই" safely.
 */
export async function fetchVideoMetadata(
  rawUrl: string,
  options?: { expectedLinkUrl?: string }
): Promise<VideoMetadata> {
  const { normalizedUrl, platform, videoId } = normalizeVideoUrl(rawUrl);
  const expectedLinkUrl = options?.expectedLinkUrl;

  // 1. YouTube Data API v3 (100% free & deterministic when YOUTUBE_API_KEY is configured)
  if (platform === 'youtube_shorts') {
    const ytData = await fetchYouTubeApiMetadata(videoId, normalizedUrl, expectedLinkUrl);
    if (ytData) return ytData;
  }

  // 2. For Facebook, TikTok, Instagram: use Apify when APIFY_API_TOKEN is configured (credit-efficient 1-item fetch)
  if (platform !== 'youtube_shorts' && isApifyConfigured()) {
    const apifyData = await fetchApifyVideoMetadata(rawUrl, platform);
    if (apifyData) {
      const daysOld = Math.max(
        0,
        Math.floor((Date.now() - new Date(apifyData.publishedDate).getTime()) / (1000 * 60 * 60 * 24))
      );
      const likeRatio =
        apifyData.views > 0 ? Number((apifyData.likes / apifyData.views).toFixed(4)) : 0;
      const commentRatio =
        apifyData.views > 0 ? Number((apifyData.comments / apifyData.views).toFixed(4)) : 0;
      const combinedText = `${apifyData.title}\n${apifyData.description}\n${apifyData.sampleComments.join('\n')}`;
      const hasBrandLink = checkLinkPresence(combinedText, expectedLinkUrl);

      return {
        platform,
        videoId,
        normalizedUrl,
        title: apifyData.title,
        author: apifyData.author,
        views: apifyData.views,
        likes: apifyData.likes,
        comments: apifyData.comments,
        likeRatio,
        commentRatio,
        description: apifyData.description,
        hashtags: apifyData.hashtags,
        publishedDate: apifyData.publishedDate,
        daysSincePublished: daysOld,
        isWithin7DaysWindow: daysOld <= 7,
        hasBrandLink,
        sampleComments: apifyData.sampleComments,
        organicReachScore:
          apifyData.views > 0 ? Math.min(99, Math.max(40, Math.round(60 + likeRatio * 400))) : 0,
        hasLiveMetrics: apifyData.views > 0 || apifyData.likes > 0,
        hasLiveText: Boolean(apifyData.title || apifyData.description),
        directMediaUrl: apifyData.directMediaUrl,
        fetchSource: 'apify',
      };
    }
  }

  // 3. Try yt-dlp live metadata extraction (works across YouTube, TikTok, public FB/IG when installed on Render)
  const ytDlpData = await fetchWithYtDlp(rawUrl, platform, videoId, normalizedUrl, expectedLinkUrl);
  if (ytDlpData && ytDlpData.hasLiveMetrics) {
    return ytDlpData;
  }

  // 3. Partial oEmbed fallback (retrieves authentic Title & Author, but NOT views/likes/comments)
  const oembed = await fetchOEmbedTitle(rawUrl, platform);
  const nowIso = new Date().toISOString();

  if (ytDlpData && ytDlpData.hasLiveText) {
    return {
      ...ytDlpData,
      fetchError: 'লাইভ ভিউ/লাইক সংখ্যা প্ল্যাটফর্ম থেকে অটো-ফেচ করা যায়নি — ম্যানুয়ালি ভিউ দেখে অনুমোদন প্রয়োজন।',
    };
  }

  if (oembed && oembed.title) {
    const hashtags = extractHashtags(oembed.title);
    return {
      platform,
      videoId,
      normalizedUrl,
      title: oembed.title,
      author: oembed.author || 'Creator',
      views: 0,
      likes: 0,
      comments: 0,
      likeRatio: 0,
      commentRatio: 0,
      description: '',
      hashtags,
      publishedDate: nowIso,
      daysSincePublished: 0,
      isWithin7DaysWindow: true,
      hasBrandLink: checkLinkPresence(oembed.title, expectedLinkUrl),
      sampleComments: [],
      organicReachScore: 0,
      hasLiveMetrics: false,
      hasLiveText: true,
      fetchSource: 'oembed_partial',
      fetchError:
        platform === 'youtube_shorts'
          ? 'YOUTUBE_API_KEY সেট না থাকায় লাইভ ভিউ ও ডেসক্রিপশন পাওয়া যায়নি (শুধু টাইটেল পাওয়া গেছে)।'
          : 'প্ল্যাটফর্ম থেকে লাইভ ভিউ/ডেসক্রিপশন পাওয়া যায়নি — ম্যানুয়াল যাচাইয়ে পাঠানো হয়েছে।',
    };
  }

  // 4. Honest unavailable result — never fake stats
  return {
    platform,
    videoId,
    normalizedUrl,
    title: '',
    author: '',
    views: 0,
    likes: 0,
    comments: 0,
    likeRatio: 0,
    commentRatio: 0,
    description: '',
    hashtags: [],
    publishedDate: nowIso,
    daysSincePublished: 0,
    isWithin7DaysWindow: true,
    hasBrandLink: false,
    sampleComments: [],
    organicReachScore: 0,
    hasLiveMetrics: false,
    hasLiveText: false,
    fetchSource: 'unavailable',
    fetchError:
      platform === 'youtube_shorts'
        ? 'YouTube Data API Key (YOUTUBE_API_KEY) বা yt-dlp না থাকায় ভিডিওর লাইভ ভিউ ও ডেসক্রিপশন ফেচ করা যায়নি।'
        : `${platform.replace('_', ' ')} প্রাইভেট/অ্যান্টি-বট প্রোটেকশনের কারণে অটোমেটিক ভিউ ও ক্যাপশন পাওয়া যায়নি।`,
  };
}
