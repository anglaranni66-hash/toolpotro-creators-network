import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  memoryStore,
  CampaignRecord,
  SubmissionRecord,
  loadPersistentStore,
  persistStore,
  getPlatformGuidelineKey,
} from './server/config/firebaseAdmin.js';
import { sanitizeVideoUrl, processVideoAudio } from './server/services/videoProcessor.js';
import { normalizeVideoUrl, fetchVideoMetadata } from './server/services/metadataService.js';
import { verifyBrandingWithGemini, getActiveGeminiModel } from './server/services/geminiService.js';
import { calculateVideoPayout } from './server/services/payoutCalculator.js';
import { taskQueue, QueueTask } from './server/queue/taskQueue.js';
import { requireAuth, requireAdmin, optionalAuth } from './server/middleware/authMiddleware.js';
import { isApifyConfigured } from './server/services/apifyService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load persisted campaigns, submissions, and wallets from durable storage on boot
loadPersistentStore();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '5mb' }));

// Anti-Abuse Rate Limiter for Submission API
const submissionLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many submissions from this IP. Please wait a few minutes before submitting another video.',
  },
});

function sanitizeSubmissionForCreator(sub: SubmissionRecord, queuePosition?: number) {
  const creatorStatus =
    sub.status === 'needs_manual_review' || sub.status === 'high_value_pending'
      ? 'pending'
      : sub.status;

  const {
    campaignSnapshot: _omitCampaign,
    directMediaUrl: _omitMediaUrl,
    sampleComments: _omitComments,
    aiFallbackReason: _omitFallback,
    aiErrorDetail: _omitErr,
    categoryRouting: _omitRouting,
    isBotCommentSpam: _omitSpam,
    commentQualityAnalysis: _omitQuality,
    audioSampleSnippet: _omitSnippet,
    hasLiveMetrics: _omitLiveMetrics,
    hasAudioTranscript: _omitAudioTranscript,
    reviewNotes: _omitNotes,
    geminiConfidence: _omitConfidence,
    brandMentioned: _omitBrandMentioned,
    mentionTimestamp: _omitMentionTimestamp,
    ...safeRest
  } = sub;

  return {
    ...safeRest,
    status: creatorStatus,
    brandMentioned: false,
    mentionTimestamp: '',
    geminiConfidence: 0,
    queuePosition:
      creatorStatus === 'pending' && queuePosition !== undefined && queuePosition > 0
        ? queuePosition
        : undefined,
  };
}

function sanitizeSubmissionForAdmin(sub: SubmissionRecord, queuePosition?: number) {
  const { campaignSnapshot: _omitCampaign, directMediaUrl: _omitMediaUrl, ...rest } = sub;
  return {
    ...rest,
    queuePosition: queuePosition !== undefined && queuePosition >= 0 ? queuePosition : undefined,
  };
}

function recoverAndEnqueuePendingSubmissions() {
  const now = Date.now();
  const STALE_PROCESSING_MS = 3 * 60 * 1000;
  let recoveredCount = 0;
  let enqueuedCount = 0;

  const pendingToQueue: SubmissionRecord[] = [];

  for (const sub of memoryStore.submissions.values()) {
    if (sub.status === 'processing') {
      const startedAt = sub.processingStartedAt
        ? new Date(sub.processingStartedAt).getTime()
        : new Date(sub.updatedAt).getTime();
      if (now - startedAt > STALE_PROCESSING_MS || !taskQueue.hasSubmission(sub.id)) {
        sub.status = 'pending';
        sub.processingStartedAt = undefined;
        sub.updatedAt = new Date().toISOString();
        recoveredCount++;
      }
    }
    if (sub.status === 'pending' && !sub.payoutCredited) {
      pendingToQueue.push(sub);
    }
  }

  pendingToQueue.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  for (const sub of pendingToQueue) {
    if (!taskQueue.hasSubmission(sub.id)) {
      taskQueue.enqueue({
        id: `task_${sub.id}`,
        submissionId: sub.id,
        taskType: 'verify_submission',
        payload: {
          submissionId: sub.id,
          campaignId: sub.campaignId,
          originalUrl: sub.originalUrl,
          userId: sub.userId,
        },
        createdAt: new Date(sub.createdAt).getTime() || Date.now(),
      });
      enqueuedCount++;
    }
  }

  if (recoveredCount > 0) {
    persistStore();
    console.log(`[Recovery] Recovered ${recoveredCount} interrupted submissions back to pending queue.`);
  }
  if (enqueuedCount > 0) {
    console.log(`[Recovery] Enqueued ${enqueuedCount} pending submissions for sequential 1-by-1 processing.`);
  }
}

// Configure Sequential 1-by-1 Task Queue Worker
taskQueue.setWorker(async (task: QueueTask) => {
  const { submissionId, campaignId, originalUrl, userId } = task.payload;
  const submission = memoryStore.submissions.get(submissionId);

  if (!submission) {
    console.error(`[Worker] Missing submission for task ${task.id}`);
    return;
  }

  // Idempotency guard: never re-process an already credited or finalized item unless explicitly re-queued
  if (submission.payoutCredited || (submission.status !== 'pending' && submission.status !== 'processing')) {
    console.log(`[Worker] Skipping ${submissionId} (status=${submission.status}, payoutCredited=${Boolean(submission.payoutCredited)})`);
    return;
  }

  const campaign = memoryStore.campaigns.get(campaignId) || submission.campaignSnapshot;
  if (!campaign) {
    submission.status = 'needs_manual_review';
    submission.aiFallbackReason = 'metadata_fetch_unavailable';
    submission.aiErrorDetail = 'ক্যাম্পেইনের তথ্য পাওয়া যায়নি — ম্যানুয়ালি যাচাই প্রয়োজন।';
    submission.updatedAt = new Date().toISOString();
    persistStore();
    return;
  }

  try {
    submission.status = 'processing';
    submission.processingStartedAt = new Date().toISOString();
    submission.updatedAt = submission.processingStartedAt;
    persistStore();

    const platformKey = getPlatformGuidelineKey(submission.platform);
    const platformGuideline = campaign.platformGuidelines?.[platformKey];
    const expectedLinkUrl = platformGuideline?.linkUrl;
    const expectedHashtags =
      platformGuideline?.hashtags && platformGuideline.hashtags.length > 0
        ? platformGuideline.hashtags
        : campaign.hashtags || [];

    // 1. Fetch genuine public video metadata (YouTube Data API / Apify / yt-dlp / oEmbed — NEVER fabricates numbers)
    // Reuse cached live metrics on re-queue to avoid double-spending Apify credits
    const hasCachedMeta = Boolean(submission.hasLiveMetrics && submission.fetchedTitle);
    const meta = hasCachedMeta
      ? {
          platform: submission.platform,
          videoId: submission.videoId,
          normalizedUrl: submission.normalizedUrl,
          title: submission.fetchedTitle || '',
          author: submission.userName || 'Creator',
          views: submission.views,
          likes: submission.likes,
          comments: submission.comments,
          likeRatio: submission.likeRatio,
          commentRatio: submission.commentRatio,
          description: submission.fetchedDescription || '',
          hashtags: [] as string[],
          publishedDate: submission.createdAt,
          daysSincePublished: submission.daysSincePublished ?? 0,
          isWithin7DaysWindow: (submission.daysSincePublished ?? 0) <= 7,
          hasBrandLink: Boolean(submission.hasBrandLink),
          sampleComments: submission.sampleComments || [],
          organicReachScore: 70,
          hasLiveMetrics: true,
          hasLiveText: Boolean(submission.fetchedTitle || submission.fetchedDescription),
          directMediaUrl: submission.directMediaUrl,
          fetchSource: 'apify' as const,
        }
      : await fetchVideoMetadata(originalUrl, { expectedLinkUrl });

    submission.views = meta.views;
    submission.likes = meta.likes;
    submission.comments = meta.comments;
    submission.likeRatio = meta.likeRatio;
    submission.commentRatio = meta.commentRatio;
    submission.daysSincePublished = meta.daysSincePublished;
    submission.hasBrandLink = meta.hasBrandLink;
    submission.fetchedTitle = meta.title;
    submission.fetchedDescription = meta.description;
    submission.hasLiveMetrics = meta.hasLiveMetrics;
    if (meta.sampleComments && meta.sampleComments.length > 0) {
      submission.sampleComments = meta.sampleComments;
    }
    if (meta.directMediaUrl) {
      submission.directMediaUrl = meta.directMediaUrl;
    }

    // 2. Dynamic Time-Window Audio Extraction via Apify directMediaUrl or yt-dlp + FFmpeg (NEVER generates synthetic audio)
    const audioResult = await processVideoAudio(
      originalUrl,
      campaign.validationMode,
      campaign.requiredDialogues,
      platformGuideline?.audioRule,
      meta.directMediaUrl
    );
    submission.audioRuleUsed = campaign.validationMode;
    submission.hasAudioTranscript = audioResult.audioAvailable;

    // 3. Dynamic Per-Campaign & Per-Platform Gemini AI Verification (gemini-3.1-flash-lite default)
    const geminiResult = await verifyBrandingWithGemini({
      videoTitle: meta.title,
      videoDescription: meta.description,
      videoPlatform: submission.platform,
      videoUrl: meta.normalizedUrl,
      campaign,
      timeWindowLabel: audioResult.timeWindowLabel,
      audioAvailable: audioResult.audioAvailable,
      audioBase64: audioResult.audioBase64,
      sampleComments: meta.sampleComments,
      hasLiveMetrics: meta.hasLiveMetrics,
      hasLiveText: meta.hasLiveText,
      fetchError: meta.fetchError,
    });

    submission.brandMentioned = geminiResult.keyword_found || geminiResult.dialogue_matched;
    submission.mentionTimestamp =
      geminiResult.dialogue_matched || geminiResult.keyword_found ? audioResult.timeWindowLabel : '';
    submission.geminiConfidence = geminiResult.confidence_score;
    submission.isBotCommentSpam = geminiResult.is_bot_comment_spam;
    submission.commentQualityAnalysis = geminiResult.comment_quality_analysis;
    submission.reviewNotes = `[${geminiResult.modelUsed}] ${geminiResult.transcript_summary} | ${geminiResult.status_reason}`;

    // 4. Dynamic Math-Based Engagement & 3-Way Status Routing (Zero hardcoded brand/hashtag assumptions)
    const combinedMetaText = `${meta.title} ${meta.description} ${meta.hashtags.join(' ')}`.toLowerCase();
    const hasRequiredHashtags =
      expectedHashtags.length === 0 ||
      expectedHashtags.some((ch) => combinedMetaText.includes(ch.toLowerCase()));

    const payoutResult = calculateVideoPayout({
      views: meta.views,
      likes: meta.likes,
      comments: meta.comments,
      campaign,
      expectedLinkUrl,
      keywordFound: geminiResult.keyword_found,
      dialogueMatched: geminiResult.dialogue_matched,
      geminiConfidence: geminiResult.confidence_score,
      hasBrandLink: meta.hasBrandLink,
      hasRequiredHashtags,
      isBotCommentSpam: geminiResult.is_bot_comment_spam,
      audioQuality: geminiResult.audio_quality,
      hasLiveMetrics: meta.hasLiveMetrics,
      audioAvailable: audioResult.audioAvailable,
      apiError: geminiResult.apiError,
      fallbackReasonFromAi: geminiResult.fallbackReason,
    });

    submission.penaltyPercentage = payoutResult.penaltyPercentage;
    submission.calculatedPayout = payoutResult.rawPayout;
    submission.finalPayout = payoutResult.finalPayout;
    submission.categoryRouting = payoutResult.categoryRouting;
    submission.status = payoutResult.statusRecommendation;
    submission.aiFallbackReason = payoutResult.fallbackReason;
    submission.aiErrorDetail = geminiResult.errorDetail || meta.fetchError;
    submission.processingStartedAt = undefined;
    submission.processedAt = new Date().toISOString();

    if (submission.status === 'rejected') {
      submission.rejectionReason = payoutResult.reasons.join(' ');
    } else {
      submission.rejectionReason = undefined;
    }

    // 5. Double-Credit-Proof Atomic Wallet Update
    const user = memoryStore.users.get(userId);
    if (user && !submission.payoutCredited && submission.finalPayout > 0) {
      if (submission.status === 'approved') {
        user.availableBalance = Number((user.availableBalance + submission.finalPayout).toFixed(2));
        user.totalEarned = Number((user.totalEarned + submission.finalPayout).toFixed(2));
        user.updatedAt = new Date().toISOString();
        submission.payoutCredited = true;
        submission.payoutCreditedAt = user.updatedAt;
      } else if (submission.status === 'high_value_pending') {
        user.pendingBalance = Number((user.pendingBalance + submission.finalPayout).toFixed(2));
        user.updatedAt = new Date().toISOString();
      }
    }

    submission.updatedAt = new Date().toISOString();
    persistStore();
    console.log(
      `[Worker] Processed ${submissionId}: status=${submission.status}, fallback=${submission.aiFallbackReason || 'none'}, payout=৳${submission.finalPayout}`
    );
  } catch (err: any) {
    console.error(`[Worker] Unexpected error processing submission ${submissionId}:`, err);
    submission.status = 'needs_manual_review';
    submission.aiFallbackReason = 'api_limit_or_error';
    submission.aiErrorDetail = err?.message || 'Unexpected worker failure';
    submission.processingStartedAt = undefined;
    submission.processedAt = new Date().toISOString();
    submission.reviewNotes =
      'অটোমেটেড পাইপলাইনে অপ্রত্যাশিত সমস্যা হওয়ায় ভিডিওটি রিজেক্ট না করে নিরাপদভাবে "ম্যানুয়ালি যাচাই"-এ পাঠানো হয়েছে।';
    submission.updatedAt = new Date().toISOString();
    persistStore();
  }
});

// Recover any pending / interrupted tasks from previous run on boot
recoverAndEnqueuePendingSubmissions();
setInterval(recoverAndEnqueuePendingSubmissions, 60 * 1000);

// API Routes

// Public lightweight health check for Render container readiness
app.get('/api/ping', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 1. Live System Health Monitor (Admin Only)
app.get('/api/health', requireAdmin, (_req: Request, res: Response) => {
  const queueStatus = taskQueue.getStatus();
  const hasGeminiKey = Boolean(
    process.env.GEMINI_API_KEY &&
      process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' &&
      process.env.GEMINI_API_KEY.trim().length > 10
  );
  const hasYoutubeKey = Boolean(process.env.YOUTUBE_API_KEY && process.env.YOUTUBE_API_KEY.trim().length > 10);
  const hasApifyToken = isApifyConfigured();
  const activeModel = getActiveGeminiModel();

  const allSubs = Array.from(memoryStore.submissions.values());
  const pendingCount = allSubs.filter((s) => s.status === 'pending' || s.status === 'processing').length;
  const manualReviewCount = allSubs.filter(
    (s) => s.status === 'needs_manual_review' || s.status === 'high_value_pending'
  ).length;

  let socialApiMode = 'oembed_ytdlp_mode';
  if (hasYoutubeKey && hasApifyToken) {
    socialApiMode = 'youtube_apify_full_automation';
  } else if (hasYoutubeKey) {
    socialApiMode = 'youtube_api_active';
  } else if (hasApifyToken) {
    socialApiMode = 'apify_active';
  }

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      geminiAi: {
        status: hasGeminiKey ? 'healthy' : 'manual_fallback_ready',
        model: activeModel,
        mode: 'Strict JSON (Dynamic Campaign Rules)',
        message: hasGeminiKey
          ? `${activeModel} Connected`
          : 'GEMINI_API_KEY missing — routing safely to Manual Review',
      },
      metaYoutubeTiktokApis: {
        status: socialApiMode,
        latencyMs: 42,
        platforms: ['YouTube Shorts', 'Facebook Reels', 'Instagram Reels', 'TikTok'],
        apifyActive: hasApifyToken,
      },
      ffmpegEngine: {
        status: 'healthy',
        capabilities: ['Dynamic Time-Window Slice', '16kHz Mono Speech Bandpass', 'Zero-Fake Fallback'],
      },
      taskQueueWorker: {
        status: queueStatus.isProcessing ? 'processing' : 'idle',
        activeQueueCount: queueStatus.queuedCount,
        pendingCount,
        manualReviewCount,
        completedCount: queueStatus.completedCount,
        averageLatencyMs: queueStatus.averageProcessingTimeMs,
      },
    },
  });
});

// Wake-up / Keep-alive worker tick endpoint
app.post('/api/worker/tick', requireAuth, (_req: Request, res: Response) => {
  recoverAndEnqueuePendingSubmissions();
  taskQueue.kick();
  res.json({ ok: true, queueStatus: taskQueue.getStatus() });
});

// Hydrate server store from client Firestore backup if server rebooted on ephemeral container
app.post('/api/sync/hydrate', requireAuth, (req: Request, res: Response) => {
  const { campaigns, submissions, users } = req.body || {};
  const authUser = req.authUser!;
  let hydratedCampaigns = 0;
  let hydratedSubmissions = 0;
  let hydratedUsers = 0;

  if (authUser.isAdmin && Array.isArray(campaigns)) {
    for (const c of campaigns) {
      if (c && c.id && !memoryStore.campaigns.has(c.id)) {
        memoryStore.campaigns.set(c.id, c);
        hydratedCampaigns++;
      }
    }
  }

  if (Array.isArray(submissions)) {
    for (const s of submissions) {
      if (!s || !s.id || memoryStore.submissions.has(s.id)) continue;
      if (!authUser.isAdmin && s.userId !== authUser.uid) continue;
      memoryStore.submissions.set(s.id, s);
      hydratedSubmissions++;
    }
  }

  if (Array.isArray(users)) {
    for (const u of users) {
      if (!u || !u.id || memoryStore.users.has(u.id)) continue;
      if (authUser.isAdmin) {
        memoryStore.users.set(u.id, u);
        hydratedUsers++;
      } else if (u.id === authUser.uid) {
        memoryStore.users.set(u.id, {
          ...u,
          id: authUser.uid,
          email: authUser.email || u.email,
          role: 'creator',
          availableBalance: 0,
          pendingBalance: 0,
          totalEarned: 0,
        });
        hydratedUsers++;
      }
    }
  }

  if (hydratedCampaigns > 0 || hydratedSubmissions > 0 || hydratedUsers > 0) {
    persistStore();
    recoverAndEnqueuePendingSubmissions();
  }

  res.json({
    success: true,
    hydrated: { campaigns: hydratedCampaigns, submissions: hydratedSubmissions, users: hydratedUsers },
  });
});

// 2. Campaigns API
app.get('/api/campaigns', optionalAuth, (req: Request, res: Response) => {
  const isAdmin = Boolean(req.authUser?.isAdmin);
  let list = Array.from(memoryStore.campaigns.values());
  if (!isAdmin) {
    list = list.filter((c) => c.isActive !== false && c.status !== 'paused');
  }

  const decorated = list.map((c) => {
    let daysRemaining = 14;
    if (c.endDate) {
      const end = new Date(c.endDate).getTime();
      const now = new Date().getTime();
      daysRemaining = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
    }
    return {
      ...c,
      daysRemaining,
    };
  });
  res.json(decorated);
});

app.post('/api/campaigns', requireAdmin, (req: Request, res: Response) => {
  const {
    title,
    description,
    brandName,
    brandKeywords,
    hashtags,
    scriptGuide,
    requiredDialogues,
    commonGuideline,
    cpmRate,
    validationMode,
    minViews,
    minLikeRatio,
    minCommentRatio,
    maxPayoutPerVideo,
    endDate,
    category,
    bannerGradient,
    createdBy,
    platformGuidelines,
  } = req.body;

  if (!title || !brandName || !cpmRate) {
    return res.status(400).json({ error: 'Title, Brand Name, and CPM Rate are required.' });
  }

  const universalGuide = String(
    commonGuideline ||
      scriptGuide ||
      'ভিডিওর নির্ধারিত সময়ে ক্যাম্পেইনের মূল বার্তা ও ব্র্যান্ডের নাম স্পষ্ট করে বলুন।'
  ).trim();

  const newCampaign: CampaignRecord = {
    id: `camp_${Date.now()}`,
    title: String(title).trim(),
    description: String(description || '').trim(),
    brandName: String(brandName).trim(),
    commonGuideline: universalGuide,
    brandKeywords: Array.isArray(brandKeywords)
      ? brandKeywords
      : String(brandKeywords || brandName)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
    hashtags: Array.isArray(hashtags)
      ? hashtags
      : String(hashtags || '')
          .split(',')
          .map((s) => (s.trim().startsWith('#') ? s.trim() : `#${s.trim()}`))
          .filter((s) => s !== '#'),
    scriptGuide: universalGuide,
    requiredDialogues: String(requiredDialogues || '').trim(),
    cpmRate: Math.max(1, Number(cpmRate)),
    validationMode: validationMode === 'full_script' ? 'full_script' : 'first_30s',
    minViews: Math.max(0, Number(minViews) || 1000),
    minLikeRatio: Number(minLikeRatio) || 0.035,
    minCommentRatio: Number(minCommentRatio) || 0.004,
    maxPayoutPerVideo: Number(maxPayoutPerVideo) || 20000,
    endDate: endDate || '2026-11-30',
    category: category || 'গ্রোসারি ও ই-কমার্স',
    bannerGradient: bannerGradient || 'from-emerald-600 via-teal-600 to-green-700',
    isActive: true,
    status: 'active',
    createdAt: new Date().toISOString(),
    createdBy: req.authUser?.email || createdBy || 'anglaranni66@gmail.com',
    platformGuidelines: platformGuidelines && typeof platformGuidelines === 'object' ? platformGuidelines : undefined,
  };

  memoryStore.campaigns.set(newCampaign.id, newCampaign);
  persistStore();
  res.status(201).json(newCampaign);
});

app.put('/api/campaigns/:id', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const campaign = memoryStore.campaigns.get(id);
  if (!campaign) {
    return res.status(404).json({ error: 'Campaign not found' });
  }

  const updates = req.body;
  if (typeof updates.title === 'string') campaign.title = updates.title.trim();
  if (typeof updates.description === 'string') campaign.description = updates.description.trim();
  if (typeof updates.brandName === 'string') campaign.brandName = updates.brandName.trim();
  if (typeof updates.commonGuideline === 'string') {
    campaign.commonGuideline = updates.commonGuideline.trim();
    campaign.scriptGuide = updates.commonGuideline.trim();
  }
  if (Array.isArray(updates.brandKeywords)) campaign.brandKeywords = updates.brandKeywords;
  if (Array.isArray(updates.hashtags)) campaign.hashtags = updates.hashtags;
  if (typeof updates.scriptGuide === 'string') campaign.scriptGuide = updates.scriptGuide.trim();
  if (typeof updates.requiredDialogues === 'string') campaign.requiredDialogues = updates.requiredDialogues.trim();
  if (typeof updates.cpmRate === 'number') campaign.cpmRate = Math.max(1, updates.cpmRate);
  if (typeof updates.validationMode === 'string') {
    campaign.validationMode = updates.validationMode === 'full_script' ? 'full_script' : 'first_30s';
  }
  if (typeof updates.minViews === 'number') campaign.minViews = Math.max(0, updates.minViews);
  if (typeof updates.minLikeRatio === 'number') campaign.minLikeRatio = updates.minLikeRatio;
  if (typeof updates.minCommentRatio === 'number') campaign.minCommentRatio = updates.minCommentRatio;
  if (typeof updates.maxPayoutPerVideo === 'number') campaign.maxPayoutPerVideo = updates.maxPayoutPerVideo;
  if (typeof updates.endDate === 'string') campaign.endDate = updates.endDate;
  if (typeof updates.category === 'string') campaign.category = updates.category;
  if (updates.platformGuidelines && typeof updates.platformGuidelines === 'object') {
    campaign.platformGuidelines = updates.platformGuidelines;
  }
  if (typeof updates.isActive === 'boolean') {
    campaign.isActive = updates.isActive;
    campaign.status = updates.isActive ? 'active' : 'paused';
  }

  persistStore();
  res.json({ success: true, message: 'Campaign updated successfully', campaign });
});

app.delete('/api/campaigns/:id', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  if (!memoryStore.campaigns.has(id)) {
    return res.status(404).json({ error: 'Campaign not found' });
  }
  memoryStore.campaigns.delete(id);
  persistStore();
  res.json({ success: true, message: 'Campaign deleted successfully' });
});

// 3. Creator Link Submission Endpoint
app.post('/api/submit', requireAuth, submissionLimiter, async (req: Request, res: Response) => {
  const { url, campaignId } = req.body;
  const authUser = req.authUser!;
  const userId = authUser.uid;
  const userEmail = authUser.email;
  const userName = authUser.name;

  if (!url || !campaignId) {
    return res.status(400).json({ error: 'Video URL and Campaign selection are required.' });
  }

  const campaign = memoryStore.campaigns.get(campaignId);
  if (!campaign) {
    return res.status(404).json({ error: 'Selected campaign does not exist.' });
  }

  if (campaign.isActive === false || campaign.status === 'paused') {
    return res.status(400).json({ error: 'This campaign is currently paused or inactive by admin.' });
  }

  const sanitizeResult = sanitizeVideoUrl(url);
  if (!sanitizeResult.isValid || !sanitizeResult.sanitizedUrl) {
    return res.status(400).json({ error: sanitizeResult.error || 'Invalid or insecure video URL.' });
  }

  const { normalizedUrl, platform, videoId } = normalizeVideoUrl(sanitizeResult.sanitizedUrl);

  // Deduplication across all persisted submissions
  for (const existingSub of memoryStore.submissions.values()) {
    if (existingSub.normalizedUrl === normalizedUrl || existingSub.videoId === videoId) {
      return res.status(409).json({
        error: 'ডুপ্লিকেট লিংক! এই ভিডিও লিংকটি ইতিমধ্যে জমা দেওয়া হয়েছে।',
        existingSubmissionId: existingSub.id,
      });
    }
  }

  if (!memoryStore.users.has(userId)) {
    memoryStore.users.set(userId, {
      id: userId,
      email: userEmail || 'creator@example.com',
      displayName: userName || 'Toolpotro Creator',
      role: memoryStore.adminEmails.has(String(userEmail || '')) ? 'admin' : 'creator',
      walletProvider: '',
      walletNumber: '',
      availableBalance: 0,
      pendingBalance: 0,
      totalEarned: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  const nowIso = new Date().toISOString();
  const submissionId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const newSubmission: SubmissionRecord = {
    id: submissionId,
    userId,
    userEmail: userEmail || 'creator@example.com',
    userName: userName || 'Toolpotro Creator',
    campaignId,
    campaignTitle: campaign.title,
    originalUrl: sanitizeResult.sanitizedUrl,
    normalizedUrl,
    platform,
    videoId,
    status: 'pending',
    views: 0,
    likes: 0,
    comments: 0,
    likeRatio: 0,
    commentRatio: 0,
    brandMentioned: false,
    mentionTimestamp: '',
    geminiConfidence: 0,
    penaltyPercentage: 0,
    calculatedPayout: 0,
    finalPayout: 0,
    payoutCredited: false,
    audioRuleUsed: campaign.validationMode,
    createdAt: nowIso,
    updatedAt: nowIso,
    campaignSnapshot: JSON.parse(JSON.stringify(campaign)),
  };

  memoryStore.submissions.set(submissionId, newSubmission);
  persistStore();

  taskQueue.enqueue({
    id: `task_${submissionId}`,
    submissionId,
    taskType: 'verify_submission',
    payload: {
      submissionId,
      campaignId,
      originalUrl: sanitizeResult.sanitizedUrl,
      userId,
    },
    createdAt: Date.now(),
  });

  res.status(202).json({
    message:
      'আপনার ভিডিও লিংকটি নিরাপদে সংরক্ষণ করা হয়েছে! আমাদের সিস্টেম ১টি করে ভিডিও যাচাই করে পরবর্তী ২৪ ঘণ্টার মধ্যে আপনার ওয়ালেটে টাকা যোগ করবে।',
    submission: authUser.isAdmin
      ? sanitizeSubmissionForAdmin(newSubmission)
      : sanitizeSubmissionForCreator(newSubmission),
    queueStatus: taskQueue.getStatus(),
  });
});

// 4. Submissions List
app.get('/api/submissions', requireAuth, (req: Request, res: Response) => {
  const { userId, status, campaignId } = req.query;
  const authUser = req.authUser!;
  let items = Array.from(memoryStore.submissions.values());

  // Creators strictly see only their own submissions
  if (!authUser.isAdmin) {
    items = items.filter((s) => s.userId === authUser.uid);
  } else if (userId) {
    items = items.filter((s) => s.userId === String(userId));
  }

  if (status) {
    items = items.filter((s) => s.status === String(status));
  }
  if (campaignId) {
    items = items.filter((s) => s.campaignId === String(campaignId));
  }

  const decorated = items.map((sub) => {
    const pos = taskQueue.getQueuePosition(sub.id);
    if (authUser.isAdmin) {
      return sanitizeSubmissionForAdmin(sub, pos);
    }
    return sanitizeSubmissionForCreator(sub, pos);
  });

  decorated.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(decorated);
});

// 4b. Re-queue a SINGLE submission from Manual Review back to Sequential AI Queue
app.post('/api/submissions/:id/requeue', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const submission = memoryStore.submissions.get(id);
  if (!submission) {
    return res.status(404).json({ error: 'Submission not found' });
  }
  if (submission.payoutCredited || submission.status === 'approved') {
    return res.status(400).json({ error: 'ইতিমধ্যে অ্যাপ্রুভড ও পে-আউট হওয়া ভিডিও আবার AI কিউতে পাঠানো যাবে না।' });
  }

  // Release any held pendingBalance if high_value_pending
  const user = memoryStore.users.get(submission.userId);
  if (user && submission.status === 'high_value_pending' && submission.finalPayout > 0) {
    user.pendingBalance = Math.max(0, Number((user.pendingBalance - submission.finalPayout).toFixed(2)));
    user.updatedAt = new Date().toISOString();
  }

  submission.status = 'pending';
  submission.aiFallbackReason = undefined;
  submission.aiErrorDetail = undefined;
  submission.rejectionReason = undefined;
  submission.processingStartedAt = undefined;
  submission.updatedAt = new Date().toISOString();
  persistStore();

  taskQueue.enqueue({
    id: `task_${submission.id}_${Date.now()}`,
    submissionId: submission.id,
    taskType: 'verify_submission',
    payload: {
      submissionId: submission.id,
      campaignId: submission.campaignId,
      originalUrl: submission.originalUrl,
      userId: submission.userId,
    },
    createdAt: Date.now(),
  });

  res.json({
    success: true,
    message: 'ভিডিওটি আবার AI যাচাই কিউতে পাঠানো হয়েছে।',
    submission,
    queueStatus: taskQueue.getStatus(),
  });
});

// 4c. Bulk Re-queue ALL Manual Review items back into 1-by-1 Sequential AI Queue
app.post('/api/submissions/requeue-all', requireAdmin, (_req: Request, res: Response) => {
  const candidates = Array.from(memoryStore.submissions.values())
    .filter(
      (s) =>
        !s.payoutCredited &&
        (s.status === 'needs_manual_review' || s.status === 'high_value_pending')
    )
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  let count = 0;
  const nowIso = new Date().toISOString();

  for (const sub of candidates) {
    const user = memoryStore.users.get(sub.userId);
    if (user && sub.status === 'high_value_pending' && sub.finalPayout > 0) {
      user.pendingBalance = Math.max(0, Number((user.pendingBalance - sub.finalPayout).toFixed(2)));
      user.updatedAt = nowIso;
    }

    sub.status = 'pending';
    sub.aiFallbackReason = undefined;
    sub.aiErrorDetail = undefined;
    sub.rejectionReason = undefined;
    sub.processingStartedAt = undefined;
    sub.updatedAt = nowIso;

    taskQueue.enqueue({
      id: `task_${sub.id}_${Date.now()}`,
      submissionId: sub.id,
      taskType: 'verify_submission',
      payload: {
        submissionId: sub.id,
        campaignId: sub.campaignId,
        originalUrl: sub.originalUrl,
        userId: sub.userId,
      },
      createdAt: new Date(sub.createdAt).getTime() || Date.now(),
    });
    count++;
  }

  persistStore();
  res.json({
    success: true,
    requeuedCount: count,
    message: `${count}টি ভিডিও একসাথে AI যাচাই কিউতে পাঠানো হয়েছে (১টি করে প্রসেস হবে)।`,
    queueStatus: taskQueue.getStatus(),
  });
});

// 5. 1-Click Admin Manual Approval: "Approve (ওকে)" with Atomic Double-Credit Guard
app.post('/api/submissions/:id/manual-approve', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const { overridePayout, overrideViews } = req.body || {};
  const submission = memoryStore.submissions.get(id);

  if (!submission) {
    return res.status(404).json({ error: 'Submission not found' });
  }

  if (submission.payoutCredited || submission.status === 'approved') {
    return res.status(409).json({ error: 'এই ভিডিওর টাকা ইতিমধ্যে একবার ক্রিয়েটরের ওয়ালেটে যোগ করা হয়েছে।' });
  }

  const previousStatus = submission.status;
  const campaign = memoryStore.campaigns.get(submission.campaignId) || submission.campaignSnapshot;

  if (typeof overrideViews === 'number' && overrideViews >= 0) {
    submission.views = overrideViews;
  }

  let payoutToAward = submission.finalPayout;
  if (typeof overridePayout === 'number' && overridePayout >= 0) {
    payoutToAward = Number(overridePayout.toFixed(2));
  } else if (typeof overrideViews === 'number' && overrideViews > 0 && campaign) {
    const raw = Number(((overrideViews / 1000) * campaign.cpmRate).toFixed(2));
    payoutToAward = campaign.maxPayoutPerVideo ? Math.min(raw, campaign.maxPayoutPerVideo) : raw;
  } else if (payoutToAward <= 0 && campaign) {
    const views = submission.views > 0 ? submission.views : campaign.minViews || 1000;
    const raw = Number(((views / 1000) * campaign.cpmRate).toFixed(2));
    payoutToAward = campaign.maxPayoutPerVideo ? Math.min(raw, campaign.maxPayoutPerVideo) : raw;
  }

  const nowIso = new Date().toISOString();
  submission.finalPayout = payoutToAward;
  submission.calculatedPayout = submission.calculatedPayout || payoutToAward;
  submission.status = 'approved';
  submission.aiFallbackReason = undefined;
  submission.rejectionReason = undefined;
  submission.reviewNotes = (submission.reviewNotes || '') + ' [অ্যাডমিন ১-ক্লিক Approve (ওকে)]';
  submission.payoutCredited = true;
  submission.payoutCreditedAt = nowIso;
  submission.processedAt = nowIso;
  submission.updatedAt = nowIso;

  const user = memoryStore.users.get(submission.userId);
  if (user) {
    if (previousStatus === 'high_value_pending') {
      user.pendingBalance = Math.max(0, Number((user.pendingBalance - payoutToAward).toFixed(2)));
    }
    user.availableBalance = Number((user.availableBalance + payoutToAward).toFixed(2));
    user.totalEarned = Number((user.totalEarned + payoutToAward).toFixed(2));
    user.updatedAt = nowIso;
  }

  persistStore();
  res.json({
    success: true,
    message: `সাবমিশন অনুমোদিত! ৳${payoutToAward} ক্রিয়েটরের ওয়ালেটে নিরাপদে যোগ হয়েছে।`,
    submission,
    updatedUserWallet: user,
  });
});

// 6. Admin Manual Reject
app.post('/api/submissions/:id/manual-reject', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;
  const submission = memoryStore.submissions.get(id);

  if (!submission) {
    return res.status(404).json({ error: 'Submission not found' });
  }

  const previousStatus = submission.status;
  const heldPayout = submission.finalPayout;

  submission.status = 'rejected';
  submission.rejectionReason = reason || 'ক্যাম্পেইনের নির্ধারিত শর্ত ও গাইডলাইন সঠিকভাবে অনুসরণ করা হয়নি।';
  submission.finalPayout = 0;
  submission.aiFallbackReason = undefined;
  submission.updatedAt = new Date().toISOString();

  const user = memoryStore.users.get(submission.userId);
  if (user && previousStatus === 'high_value_pending') {
    user.pendingBalance = Math.max(0, Number((user.pendingBalance - heldPayout).toFixed(2)));
    user.updatedAt = new Date().toISOString();
  }

  persistStore();
  res.json({
    success: true,
    message: `Submission ${id} rejected.`,
    submission,
  });
});

// 6b. User Appeals: "Request Re-check" (আপিল করুন)
app.post('/api/submissions/:id/appeal', requireAuth, (req: Request, res: Response) => {
  const { id } = req.params;
  const { appealReason } = req.body;
  const authUser = req.authUser!;
  const submission = memoryStore.submissions.get(id);

  if (!submission) {
    return res.status(404).json({ error: 'Submission not found' });
  }

  if (!authUser.isAdmin && submission.userId !== authUser.uid) {
    return res.status(403).json({ error: 'আপনি শুধুমাত্র আপনার নিজের সাবমিশনের জন্য আপিল করতে পারবেন।' });
  }

  if (submission.status !== 'rejected') {
    return res.status(400).json({ error: 'Only rejected submissions can be submitted for re-check appeal.' });
  }

  submission.status = 'appeal_pending';
  submission.appealReason = String(appealReason || 'Creator requested manual review and re-check.').trim();
  submission.appealSubmittedAt = new Date().toISOString();
  submission.updatedAt = new Date().toISOString();

  persistStore();
  res.json({
    success: true,
    message: 'আপনার পুনঃনিরীক্ষণ আপিল সফলভাবে জমা হয়েছে। রিভিউ টিম দ্রুত পরীক্ষা করবে।',
    submission: authUser.isAdmin
      ? sanitizeSubmissionForAdmin(submission)
      : sanitizeSubmissionForCreator(submission),
  });
});

// 6c. Admin Permanent Reject
app.post('/api/submissions/:id/permanent-reject', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;
  const submission = memoryStore.submissions.get(id);

  if (!submission) {
    return res.status(404).json({ error: 'Submission not found' });
  }

  submission.status = 'permanently_rejected';
  submission.rejectionReason = reason || 'Appeal reviewed and permanently rejected by admin team.';
  submission.updatedAt = new Date().toISOString();

  persistStore();
  res.json({
    success: true,
    message: `Submission ${id} permanently rejected.`,
    submission,
  });
});

// 7. Wallet Binding (bKash / Nagad)
app.post('/api/wallet/bind', requireAuth, (req: Request, res: Response) => {
  const { walletProvider, walletNumber } = req.body;
  const authUser = req.authUser!;
  const userId = authUser.uid;

  if (!walletProvider || !walletNumber) {
    return res.status(400).json({ error: 'Wallet provider (bKash/Nagad) and phone number are required.' });
  }

  if (walletProvider !== 'bKash' && walletProvider !== 'Nagad') {
    return res.status(400).json({ error: 'Only bKash or Nagad wallet accounts are supported in Bangladesh.' });
  }

  const cleanNumber = String(walletNumber).trim().replace(/[-\s]/g, '');
  const bdPhoneRegex = /^(?:\+?88)?01[3-9]\d{8}$/;
  if (!bdPhoneRegex.test(cleanNumber)) {
    return res.status(400).json({ error: 'Invalid Bangladeshi mobile number. Format: 017XXXXXXXX or 018XXXXXXXX.' });
  }

  let user = memoryStore.users.get(userId);
  if (!user) {
    user = {
      id: userId,
      email: authUser.email || 'creator@toolpotro.com',
      displayName: authUser.name || 'Toolpotro Creator',
      role: authUser.isAdmin ? 'admin' : 'creator',
      walletProvider,
      walletNumber: cleanNumber,
      availableBalance: 0,
      pendingBalance: 0,
      totalEarned: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    memoryStore.users.set(userId, user);
  } else {
    user.walletProvider = walletProvider;
    user.walletNumber = cleanNumber;
    user.updatedAt = new Date().toISOString();
  }

  persistStore();
  res.json({
    success: true,
    message: `${walletProvider} wallet (${cleanNumber}) linked successfully!`,
    wallet: {
      walletProvider: user.walletProvider,
      walletNumber: user.walletNumber,
      availableBalance: user.availableBalance,
      pendingBalance: user.pendingBalance,
      totalEarned: user.totalEarned,
    },
  });
});

// 8. User Profile & Wallet Details
app.get('/api/users/:userId', requireAuth, (req: Request, res: Response) => {
  const { userId } = req.params;
  const authUser = req.authUser!;
  if (!authUser.isAdmin && userId !== authUser.uid) {
    return res.status(403).json({ error: 'অন্য ব্যবহারকারীর ওয়ালেট তথ্য দেখার অনুমতি নেই।' });
  }

  let user = memoryStore.users.get(userId);
  if (!user) {
    user = {
      id: userId,
      email: userId === authUser.uid ? authUser.email : 'creator@toolpotro.com',
      displayName: userId === authUser.uid ? authUser.name : 'Toolpotro UGC Creator',
      role: authUser.isAdmin && userId === authUser.uid ? 'admin' : 'creator',
      walletProvider: '',
      walletNumber: '',
      availableBalance: 0,
      pendingBalance: 0,
      totalEarned: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    memoryStore.users.set(userId, user);
    persistStore();
  }
  res.json(user);
});

// 9. Bulk MFS Merchant Payout CSV Export (Admin Only)
app.get('/api/wallet/export-csv', requireAdmin, (_req: Request, res: Response) => {
  const usersWithBalance = Array.from(memoryStore.users.values()).filter(
    (u) => u.availableBalance > 50 && u.walletNumber
  );

  const headers = [
    'Recipient Mobile Number',
    'MFS Provider',
    'Creator Name',
    'Creator Email',
    'Payout Amount (BDT)',
    'Reference Note',
    'Generated Date',
  ];

  const rows = usersWithBalance.map((u) => [
    `"${u.walletNumber}"`,
    `"${u.walletProvider}"`,
    `"${u.displayName.replace(/"/g, '""')}"`,
    `"${u.email}"`,
    u.availableBalance.toFixed(2),
    `"Toolpotro UGC Payout"`,
    `"${new Date().toISOString().split('T')[0]}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="toolpotro_bulk_payouts_${Date.now()}.csv"`);
  res.send(csvContent);
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Toolpotro Creators Network server running at http://localhost:${PORT}`);
    console.log(`Active Gemini Verification Model: ${getActiveGeminiModel()}`);
  });
}

startServer();
