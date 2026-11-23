export interface PlatformGuideline {
  videoCreationGuide?: string;
  titleRule?: string;
  descriptionRule?: string;
  tags?: string[];
  captionText?: string;
  pinnedCommentRule?: string;
  bioLinkRule?: string;
  linkUrl?: string;
  hashtags?: string[];
  keywords?: string[];
  audioRule?: string;
  titleKeywords?: string[];
  captionOrTitleRule?: string;
  descriptionOrCommentRule?: string;
  captionOrDescription?: string;
  linkPlacementRule?: string;
  additionalNotes?: string;
}

export interface PlatformGuidelinesMap {
  youtube?: PlatformGuideline;
  facebook?: PlatformGuideline;
  tiktok?: PlatformGuideline;
  instagram?: PlatformGuideline;
}

export interface Campaign {
  id: string;
  title: string;
  description: string;
  commonGuideline?: string;
  brandName: string;
  brandKeywords: string[];
  hashtags: string[];
  scriptGuide: string;
  requiredDialogues: string;
  cpmRate: number;
  validationMode: 'first_30s' | 'full_script';
  minViews: number;
  minLikeRatio: number;
  minCommentRatio: number;
  maxPayoutPerVideo: number;
  endDate: string;
  daysRemaining?: number;
  category: string;
  bannerGradient: string;
  isActive: boolean;
  status: 'active' | 'paused' | 'completed';
  createdAt: string;
  createdBy: string;
  platformGuidelines?: PlatformGuidelinesMap;
}

export type SubmissionStatus =
  | 'pending'
  | 'processing'
  | 'approved'
  | 'rejected'
  | 'needs_manual_review'
  | 'high_value_pending'
  | 'appeal_pending'
  | 'permanently_rejected';

export type FallbackReason =
  | 'api_limit_or_error'
  | 'metadata_fetch_unavailable'
  | 'audio_unavailable_for_ai'
  | 'low_confidence'
  | 'high_value_20k'
  | 'noisy_audio';

export interface Submission {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  campaignId: string;
  campaignTitle: string;
  originalUrl: string;
  normalizedUrl: string;
  platform: 'youtube_shorts' | 'facebook_reels' | 'tiktok' | 'instagram';
  videoId: string;
  status: SubmissionStatus;
  views: number;
  likes: number;
  comments: number;
  likeRatio: number;
  commentRatio: number;
  brandMentioned: boolean;
  mentionTimestamp: string;
  geminiConfidence: number;
  penaltyPercentage: number;
  calculatedPayout: number;
  finalPayout: number;
  payoutCredited?: boolean;
  payoutCreditedAt?: string;
  rejectionReason?: string;
  reviewNotes?: string;
  aiFallbackReason?: FallbackReason;
  aiErrorDetail?: string;
  fetchedTitle?: string;
  fetchedDescription?: string;
  hasLiveMetrics?: boolean;
  hasAudioTranscript?: boolean;
  audioRuleUsed: 'first_30s' | 'full_script';
  createdAt: string;
  updatedAt: string;
  processedAt?: string;
  queuePosition?: number;
  daysSincePublished?: number;
  hasBrandLink?: boolean;
  appealReason?: string;
  appealSubmittedAt?: string;
  categoryRouting?: 'category_a_approved' | 'category_b_rejected' | 'category_c_review';
  isBotCommentSpam?: boolean;
  commentQualityAnalysis?: string;
  sampleComments?: string[];
}

export interface UserWallet {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: 'creator' | 'admin';
  walletProvider: 'bKash' | 'Nagad' | '';
  walletNumber: string;
  availableBalance: number;
  pendingBalance: number;
  totalEarned: number;
  createdAt: string;
  updatedAt: string;
}

export interface HealthStatus {
  status: string;
  timestamp: string;
  services: {
    geminiAi: {
      status: string;
      model: string;
      mode: string;
      message: string;
    };
    metaYoutubeTiktokApis: {
      status: string;
      latencyMs: number;
      platforms: string[];
      apifyActive?: boolean;
    };
    ffmpegEngine: {
      status: string;
      capabilities: string[];
    };
    taskQueueWorker: {
      status: string;
      activeQueueCount: number;
      pendingCount?: number;
      manualReviewCount?: number;
      completedCount: number;
      averageLatencyMs: number;
    };
  };
}
