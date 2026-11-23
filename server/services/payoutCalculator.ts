import { CampaignRecord, FallbackReason } from '../config/firebaseAdmin.js';

export interface PayoutCalculationResult {
  rawPayout: number;
  penaltyPercentage: number;
  penaltyDeduction: number;
  finalPayout: number;
  isHighValueHeld: boolean;
  isBotSuspected: boolean;
  categoryRouting: 'category_a_approved' | 'category_b_rejected' | 'category_c_review';
  statusRecommendation: 'approved' | 'rejected' | 'needs_manual_review' | 'high_value_pending';
  fallbackReason?: FallbackReason;
  reasons: string[];
}

export function calculateVideoPayout(params: {
  views: number;
  likes: number;
  comments: number;
  campaign: CampaignRecord;
  expectedLinkUrl?: string;
  keywordFound: boolean;
  dialogueMatched: boolean;
  geminiConfidence: number;
  hasBrandLink: boolean;
  hasRequiredHashtags: boolean;
  isBotCommentSpam: boolean;
  audioQuality: string;
  hasLiveMetrics: boolean;
  audioAvailable: boolean;
  apiError?: boolean;
  fallbackReasonFromAi?: FallbackReason;
}): PayoutCalculationResult {
  const {
    views,
    likes,
    comments,
    campaign,
    expectedLinkUrl,
    keywordFound,
    dialogueMatched,
    geminiConfidence,
    hasBrandLink,
    hasRequiredHashtags,
    isBotCommentSpam,
    audioQuality,
    hasLiveMetrics,
    audioAvailable,
    apiError,
    fallbackReasonFromAi,
  } = params;

  const reasons: string[] = [];

  // 1. If API failed or live metadata/audio could not be fetched -> NEVER auto-reject or auto-approve!
  // Calculate estimated CPM payout if views are known (or 0 if views unavailable so Admin can input/verify), and send to Manual Review.
  if (apiError || !hasLiveMetrics || !audioAvailable) {
    const rawPayout = views > 0 ? Number(((views / 1000) * campaign.cpmRate).toFixed(2)) : 0;
    const cappedPayout =
      campaign.maxPayoutPerVideo && rawPayout > campaign.maxPayoutPerVideo
        ? campaign.maxPayoutPerVideo
        : rawPayout;

    const reasonText = apiError
      ? 'Gemini API লিমিট/এররের কারণে "ম্যানুয়ালি যাচাই" ট্যাবে পাঠানো হয়েছে।'
      : !hasLiveMetrics
        ? 'প্ল্যাটফর্ম থেকে লাইভ ভিউ/মেটাডেটা অটো-ফেচ হয়নি — "ম্যানুয়ালি যাচাই" ট্যাবে পাঠানো হয়েছে।'
        : 'ভিডিওর আসল অডিও স্ট্রিম অটো-এক্সট্র্যাক্ট হয়নি — "ম্যানুয়ালি যাচাই" ট্যাবে পাঠানো হয়েছে।';
    reasons.push(reasonText);

    return {
      rawPayout,
      penaltyPercentage: 0,
      penaltyDeduction: 0,
      finalPayout: cappedPayout,
      isHighValueHeld: views >= 20000,
      isBotSuspected: false,
      categoryRouting: 'category_c_review',
      statusRecommendation: views >= 20000 ? 'high_value_pending' : 'needs_manual_review',
      fallbackReason:
        fallbackReasonFromAi ||
        (apiError
          ? 'api_limit_or_error'
          : !hasLiveMetrics
            ? 'metadata_fetch_unavailable'
            : 'audio_unavailable_for_ai'),
      reasons,
    };
  }

  // 2. Minimum view check (only when live views were genuinely fetched!)
  if (views < campaign.minViews) {
    reasons.push(
      `ভিউ সংখ্যা (${views.toLocaleString()}) এই ক্যাম্পেইনের ন্যূনতম ভিউ (${campaign.minViews.toLocaleString()})-এর চেয়ে কম।`
    );
    return {
      rawPayout: 0,
      penaltyPercentage: 100,
      penaltyDeduction: 0,
      finalPayout: 0,
      isHighValueHeld: false,
      isBotSuspected: false,
      categoryRouting: 'category_b_rejected',
      statusRecommendation: 'rejected',
      reasons,
    };
  }

  // 3. Instant Category B (Auto-Reject): Zero brand keyword & dialogue match with clear audio
  if (!keywordFound && !dialogueMatched && geminiConfidence <= 25) {
    reasons.push(
      `অটো-রিজেক্ট: "${campaign.title}" ক্যাম্পেইনের নির্ধারিত ডায়লগ বা ব্র্যান্ড কিওয়ার্ড (${campaign.brandName}) ভিডিওতে পাওয়া যায়নি।`
    );
    return {
      rawPayout: 0,
      penaltyPercentage: 100,
      penaltyDeduction: 0,
      finalPayout: 0,
      isHighValueHeld: false,
      isBotSuspected: false,
      categoryRouting: 'category_b_rejected',
      statusRecommendation: 'rejected',
      reasons,
    };
  }

  // Raw CPM payout: (views / 1,000) * CPM
  const rawPayout = Number(((views / 1000) * campaign.cpmRate).toFixed(2));
  const actualLikeRatio = views > 0 ? likes / views : 0;
  const actualCommentRatio = views > 0 ? comments / views : 0;

  let penaltyPercentage = 0;
  let isBotSuspected = false;

  if (views >= 5000 && comments === 0) {
    isBotSuspected = true;
    penaltyPercentage += 25;
    reasons.push('বট সন্দেহ: বেশি ভিউ কিন্তু শূন্য কমেন্ট।');
  }

  if (isBotCommentSpam) {
    isBotSuspected = true;
    penaltyPercentage += 20;
    reasons.push('Gemini AI বট ফ্ল্যাগ: কমেন্টে অটোমেটেড স্প্যামের লক্ষণ পাওয়া গেছে।');
  }

  if (actualLikeRatio < 0.005) {
    isBotSuspected = true;
    penaltyPercentage += 20;
    reasons.push('কম এনগেজমেন্ট: ভিউ অনুপাতে লাইক ০.৫%-এর নিচে।');
  }

  const minLikesBenchmark = campaign.minLikeRatio || 0.035;
  if (actualLikeRatio < minLikesBenchmark) {
    const shortfallRatio = (minLikesBenchmark - actualLikeRatio) / minLikesBenchmark;
    const likePenalty = Math.round(shortfallRatio * 20);
    penaltyPercentage += likePenalty;
    reasons.push(
      `লাইক রেশিও (${(actualLikeRatio * 100).toFixed(1)}%) নির্ধারিত মান (${(minLikesBenchmark * 100).toFixed(
        1
      )}%)-এর নিচে (-${likePenalty}%)।`
    );
  }

  const minCommentsBenchmark = campaign.minCommentRatio || 0.004;
  if (actualCommentRatio < minCommentsBenchmark) {
    const shortfallRatio = (minCommentsBenchmark - actualCommentRatio) / minCommentsBenchmark;
    const commentPenalty = Math.round(shortfallRatio * 15);
    penaltyPercentage += commentPenalty;
    reasons.push(
      `কমেন্ট রেশিও (${(actualCommentRatio * 100).toFixed(2)}%) নির্ধারিত মান (${(minCommentsBenchmark * 100).toFixed(
        2
      )}%)-এর নিচে (-${commentPenalty}%)।`
    );
  }

  if (!hasRequiredHashtags && (campaign.hashtags?.length || 0) > 0) {
    penaltyPercentage += 10;
    reasons.push('ক্যাম্পেইনের নির্ধারিত হ্যাশট্যাগ ক্যাপশন/ডেসক্রিপশনে অনুপস্থিত (-১০%)।');
  }

  if (!hasBrandLink && expectedLinkUrl) {
    penaltyPercentage += 10;
    reasons.push(`নির্ধারিত লিংক (${expectedLinkUrl}) ক্যাপশন বা কমেন্টে পাওয়া যায়নি (-১০%)।`);
  }

  penaltyPercentage = Math.min(60, penaltyPercentage);
  const penaltyDeduction = Number(((rawPayout * penaltyPercentage) / 100).toFixed(2));
  let finalPayout = Math.max(0, Number((rawPayout - penaltyDeduction).toFixed(2)));

  if (campaign.maxPayoutPerVideo && finalPayout > campaign.maxPayoutPerVideo) {
    reasons.push(`ক্যাম্পেইনের সর্বোচ্চ সীমা ৳${campaign.maxPayoutPerVideo.toLocaleString()} প্রযোজ্য হয়েছে।`);
    finalPayout = campaign.maxPayoutPerVideo;
  }

  const isHighValue = views >= 20000;
  let categoryRouting: 'category_a_approved' | 'category_b_rejected' | 'category_c_review';
  let statusRecommendation: 'approved' | 'rejected' | 'needs_manual_review' | 'high_value_pending';
  let fallbackReason: FallbackReason | undefined;

  if (isHighValue) {
    categoryRouting = 'category_c_review';
    statusRecommendation = 'high_value_pending';
    fallbackReason = 'high_value_20k';
    reasons.push(`হাই-ভ্যালু সুরক্ষা: ${views.toLocaleString()} ভিউ হওয়ায় অ্যাডমিনের ১-ক্লিক যাচাইয়ের জন্য রাখা হয়েছে।`);
  } else if (
    keywordFound &&
    dialogueMatched &&
    geminiConfidence >= 80 &&
    audioQuality === 'clear' &&
    !isBotSuspected
  ) {
    categoryRouting = 'category_a_approved';
    statusRecommendation = 'approved';
    reasons.push(`অটো-অ্যাপ্রুভড: কনফিডেন্স ${geminiConfidence}%, ডায়লগ ও নিয়ম যাচাইকৃত।`);
  } else {
    categoryRouting = 'category_c_review';
    statusRecommendation = 'needs_manual_review';
    fallbackReason = audioQuality !== 'clear' ? 'noisy_audio' : 'low_confidence';
    reasons.push(
      `ম্যানুয়াল রিভিউ: কনফিডেন্স ${geminiConfidence}% বা অডিও/স্ক্রিপ্ট নিশ্চিত হতে অ্যাডমিন যাচাই প্রয়োজন।`
    );
  }

  return {
    rawPayout,
    penaltyPercentage,
    penaltyDeduction,
    finalPayout,
    isHighValueHeld: isHighValue,
    isBotSuspected,
    categoryRouting,
    statusRecommendation,
    fallbackReason,
    reasons,
  };
}
