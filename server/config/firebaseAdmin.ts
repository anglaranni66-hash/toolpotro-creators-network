import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

let dbInstance: Firestore | null = null;
let firebaseConfig: any = null;

try {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, 'utf-8');
    firebaseConfig = JSON.parse(raw);
  }
} catch (err) {
  console.warn('[FirebaseConfig] Warning loading firebase-applet-config.json:', err);
}

export function getFirebaseDb(): Firestore | null {
  if (dbInstance) return dbInstance;
  if (!firebaseConfig) {
    console.warn('[FirebaseDb] No firebase configuration found');
    return null;
  }

  try {
    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    dbInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);
    console.log('[FirebaseDb] Initialized successfully with projectId:', firebaseConfig.projectId);
    return dbInstance;
  } catch (err) {
    console.error('[FirebaseDb] Initialization failed:', err);
    return null;
  }
}

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

export interface CampaignRecord {
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
  category: string;
  bannerGradient: string;
  isActive: boolean;
  status: 'active' | 'paused' | 'completed';
  createdAt: string;
  createdBy: string;
  platformGuidelines?: PlatformGuidelinesMap;
}

export type FallbackReason =
  | 'api_limit_or_error'
  | 'metadata_fetch_unavailable'
  | 'audio_unavailable_for_ai'
  | 'low_confidence'
  | 'high_value_20k'
  | 'noisy_audio';

export interface SubmissionRecord {
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
  status:
    | 'pending'
    | 'processing'
    | 'approved'
    | 'rejected'
    | 'needs_manual_review'
    | 'high_value_pending'
    | 'appeal_pending'
    | 'permanently_rejected';
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
  processingStartedAt?: string;
  processedAt?: string;
  audioSampleSnippet?: string;
  queuePosition?: number;
  daysSincePublished?: number;
  hasBrandLink?: boolean;
  appealReason?: string;
  appealSubmittedAt?: string;
  categoryRouting?: 'category_a_approved' | 'category_b_rejected' | 'category_c_review';
  isBotCommentSpam?: boolean;
  commentQualityAnalysis?: string;
  sampleComments?: string[];
  directMediaUrl?: string;
  campaignSnapshot?: CampaignRecord;
}

export interface UserWalletRecord {
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

export const initialCampaigns: CampaignRecord[] = [
  {
    id: 'toolpotro-mega-grocery-2026',
    title: 'টুলপত্র মেগা ক্যাম্পেইন (Toolpotro UGC)',
    description: 'টুলপত্রের প্রিমিয়াম কালেকশন ও দ্রুত অনলাইন ডেলিভারি সেবার অভিজ্ঞতা নিয়ে শর্ট ভিডিও তৈরি করে আয় করুন।',
    commonGuideline:
      '১. ভিডিওর শুরুতেই টুলপত্র ওয়েবসাইট বা অ্যাপে অর্ডার দেওয়ার দৃশ্য অথবা ডেলিভারির প্যাকেট আনবক্সিং দেখাবেন।\n২. পণ্যের মান, প্যাকেজিং ও ব্যবহারের অভিজ্ঞতা ক্লোজআপে তুলে ধরবেন।\n৩. প্রথম ১৫-৩০ সেকেন্ডের মধ্যে টুলপত্র (Toolpotro)-এর নাম স্পষ্টভাবে উচ্চারণ করবেন এবং দ্রুত ডেলিভারির বিষয়টি হাইলাইট করবেন।\n৪. প্রতিটি প্ল্যাটফর্মের নির্ধারিত লিংক ও নিয়ম অনুসরণ করবেন।',
    brandName: 'টুলপত্র (Toolpotro)',
    brandKeywords: ['Toolpotro', 'টুলপত্র', 'Toolpotro App', 'toolpotro.com', 'Toolpotro BD'],
    hashtags: ['#Toolpotro', '#টুলপত্র', '#ToolpotroCreators', '#DhakaShopping', '#UGC'],
    scriptGuide:
      '১. ভিডিওর শুরুতেই টুলপত্র ওয়েবসাইট বা অ্যাপে অর্ডার দেওয়ার দৃশ্য অথবা ডেলিভারির প্যাকেট আনবক্সিং দেখাবেন।\n২. পণ্যের মান, প্যাকেজিং ও ব্যবহারের অভিজ্ঞতা ক্লোজআপে তুলে ধরবেন।\n৩. প্রথম ১৫-৩০ সেকেন্ডের মধ্যে টুলপত্র (Toolpotro)-এর নাম স্পষ্টভাবে উচ্চারণ করবেন এবং দ্রুত ডেলিভারির বিষয়টি হাইলাইট করবেন।',
    requiredDialogues:
      'ভিডিওর প্রথম ১৫-৩০ সেকেন্ডে অবশ্যই বলুন: "সেরা মানের সব পণ্য এখন সহজেই পাচ্ছি টুলপত্র (Toolpotro)-এ!"',
    cpmRate: 180,
    validationMode: 'first_30s',
    minViews: 1000,
    minLikeRatio: 0.035,
    minCommentRatio: 0.004,
    maxPayoutPerVideo: 15000,
    endDate: '2026-11-30',
    category: 'ই-কমার্স ও লাইফস্টাইল',
    bannerGradient: 'from-emerald-600 via-teal-600 to-green-700',
    isActive: true,
    status: 'active',
    createdAt: new Date().toISOString(),
    createdBy: 'anglaranni66@gmail.com',
    platformGuidelines: {
      youtube: {
        titleRule: 'ঘরে বসেই সেরা প্রোডাক্ট টুলপত্রে! | Toolpotro Review & Unboxing',
        descriptionRule:
          'ভিডিও ডেসক্রিপশনের প্রথম বা দ্বিতীয় লাইনে সরাসরি অফিশিয়াল লিংক https://toolpotro.com দিন।',
        tags: ['toolpotro', 'toolpotro review', 'online shopping bd', 'unboxing', 'fast delivery'],
        captionOrTitleRule:
          'টাইটেল আপনার পছন্দমতো আকর্ষণীয় করে দিন (যেমন: "ঘরে বসেই সেরা প্রোডাক্ট টুলপত্রে!")।',
        descriptionOrCommentRule:
          'ভিডিও ডেসক্রিপশনের প্রথম বা দ্বিতীয় লাইনে সরাসরি অফিশিয়াল লিংক https://toolpotro.com দিন।',
        hashtags: ['#Toolpotro', '#টুলপত্র', '#ToolpotroReview', '#YouTubeShorts'],
        keywords: ['Toolpotro', 'টুলপত্র', 'Online Shopping BD', 'Toolpotro Review'],
        audioRule:
          'ভিডিওর প্রথম ১৫-৩০ সেকেন্ডে অবশ্যই বলুন: "সেরা মানের সব পণ্য এখন সহজেই পাচ্ছি টুলপত্র (Toolpotro)-এ!"',
        linkUrl: 'https://toolpotro.com',
        titleKeywords: ['Toolpotro', 'টুলপত্র', 'Toolpotro Review'],
      },
      facebook: {
        captionText:
          'ঝামেলা ছাড়াই আসল পণ্যের নির্ভরযোগ্য ঠিকানা টুলপত্র (Toolpotro)! এখনই অর্ডার করতে পারেন।',
        pinnedCommentRule:
          'ভিডিও পোস্ট করার পর প্রথম কমেন্টে (Pinned Comment) অথবা ক্যাপশনের শুরুতে https://toolpotro.com লিংক যুক্ত করে পিন করে রাখুন।',
        tags: ['টুলপত্র', 'Toolpotro', 'অনলাইন শপিং'],
        captionOrTitleRule: 'ক্যাপশনে আপনার নিজস্ব ভাষায় ভিডিওর মূল বার্তা সংক্ষেপে লিখুন।',
        descriptionOrCommentRule:
          'ভিডিও পোস্ট করার পর প্রথম কমেন্টে (Pinned Comment) অথবা ক্যাপশনের শুরুতে https://toolpotro.com লিংক যুক্ত করে পিন করে রাখুন।',
        hashtags: ['#Toolpotro', '#টুলপত্র', '#FacebookReels', '#OnlineShoppingBD'],
        keywords: ['টুলপত্র', 'Toolpotro', 'অনলাইন শপিং'],
        audioRule: 'ভিডিওতে সরাসরি বলুন "টুলপত্র (Toolpotro) থেকে সহজেই অর্ডার করতে পারবেন"।',
        linkUrl: 'https://toolpotro.com',
        titleKeywords: ['টুলপত্র', 'Toolpotro'],
      },
      tiktok: {
        captionText: 'সেরা প্রোডাক্ট খুঁজছেন? এখনই দেখুন টুলপত্রে (Toolpotro)!',
        bioLinkRule: 'আপনার টিকটক প্রোফাইল বায়োতে (Bio Link) অথবা ভিডিওর ক্যাপশনে toolpotro.com লিংক উল্লেখ করুন।',
        tags: ['টুলপত্র', 'Toolpotro', 'TikTokBD'],
        captionOrTitleRule: 'ক্যাপশনে শর্ট হুক দিন।',
        descriptionOrCommentRule:
          'আপনার টিকটক প্রোফাইল বায়োতে (Bio Link) অথবা ভিডিওর ক্যাপশনে toolpotro.com লিংক উল্লেখ করুন।',
        hashtags: ['#Toolpotro', '#টুলপত্র', '#TikTokBangladesh', '#FYP'],
        keywords: ['টুলপত্র', 'Toolpotro', 'TikTokBD'],
        audioRule: 'অডিওতে প্রথম ১৫-২০ সেকেন্ডে ব্র্যান্ডের নাম "টুলপত্র" বা "Toolpotro" বলা বাধ্যতামূলক।',
        linkUrl: 'https://toolpotro.com',
      },
      instagram: {
        captionText:
          'Quality products delivered right to your doorstep! ✨ অর্ডার করতে ভিজিট করুন বায়ো লিংকে।',
        bioLinkRule:
          'আপনার ইনস্টাগ্রাম বায়ো লিংক (Bio Link) অথবা ইনস্টাগ্রাম স্টোরির লিংক স্টিকারে https://toolpotro.com যুক্ত করুন।',
        tags: ['টুলপত্র', 'Toolpotro', 'InstaBD'],
        captionOrTitleRule: 'ইনস্টাগ্রাম রিলসের সাথে মানানসই ক্যাচি ক্যাপশন লিখুন।',
        descriptionOrCommentRule:
          'আপনার ইনস্টাগ্রাম বায়ো লিংক (Bio Link) অথবা ইনস্টাগ্রাম স্টোরির লিংক স্টিকারে https://toolpotro.com যুক্ত করুন।',
        hashtags: ['#Toolpotro', '#ToolpotroReels', '#InstaDhaka', '#টুলপত্র'],
        keywords: ['টুলপত্র', 'Toolpotro', 'InstaBD'],
        audioRule: 'ভিডিওর শুরুতে টুলপত্র (Toolpotro) ব্যবহারের অভিজ্ঞতা ও নাম স্পষ্টভাবে বলতে হবে।',
        linkUrl: 'https://toolpotro.com',
      },
    },
  },
  {
    id: 'toolpotro-premium-collection-2026',
    title: 'টুলপত্র প্রিমিয়াম কালেকশন ও প্রোডাক্ট রিভিউ',
    description:
      'টুলপত্রের পছন্দের প্রিমিয়াম প্রোডাক্টগুলোর আনবক্সিং ও আসল অভিজ্ঞতা নিয়ে আকর্ষণীয় শর্ট ভিডিও তৈরি করুন।',
    commonGuideline:
      '১. প্রোডাক্টের আনবক্সিং বা ব্যবহারের চমৎকার দৃশ্য দিয়ে ভিডিও শুরু করুন।\n২. প্রোডাক্টের কোয়ালিটি ও প্যাকেজিং প্রশংসা করুন।\n৩. প্রথম ২০ সেকেন্ডের মধ্যে টুলপত্রের নাম উল্লেখ করুন।',
    brandName: 'Toolpotro Lifestyle',
    brandKeywords: ['Toolpotro', 'টুলপত্র', 'Toolpotro Lifestyle', 'Toolpotro Online'],
    hashtags: ['#Toolpotro', '#টুলপত্র', '#ProductReview', '#UnboxingBD'],
    scriptGuide:
      '১. প্রোডাক্টের আনবক্সিং বা ব্যবহারের চমৎকার দৃশ্য দিয়ে ভিডিও শুরু করুন।\n২. প্রোডাক্টের কোয়ালিটি ও প্যাকেজিং প্রশংসা করুন।\n৩. প্রথম ২০ সেকেন্ডের মধ্যে টুলপত্রের নাম উল্লেখ করুন।',
    requiredDialogues:
      'প্রথম ২০ সেকেন্ডে বলুন: "দরকারি ও প্রিমিয়াম মানের পণ্য আমি সবসময় টুলপত্র থেকেই নিচ্ছি।"',
    cpmRate: 220,
    validationMode: 'first_30s',
    minViews: 2000,
    minLikeRatio: 0.04,
    minCommentRatio: 0.005,
    maxPayoutPerVideo: 25000,
    endDate: '2026-11-20',
    category: 'লাইফস্টাইল ও গিফট',
    bannerGradient: 'from-amber-600 via-orange-600 to-red-600',
    isActive: true,
    status: 'active',
    createdAt: new Date().toISOString(),
    createdBy: 'anglaranni66@gmail.com',
    platformGuidelines: {
      youtube: {
        titleRule: 'প্রিমিয়াম প্রোডাক্টের আসল আনবক্সিং রিভিউ! | Toolpotro',
        descriptionRule:
          'সেরা মানের পণ্য অর্ডার করতে ভিজিট করুন টুলপত্র: https://toolpotro.com',
        tags: ['Toolpotro', 'টুলপত্র রিভিউ', 'Unboxing BD'],
        titleKeywords: ['Toolpotro', 'টুলপত্র রিভিউ', 'Unboxing BD'],
        captionOrDescription:
          'সেরা মানের পণ্য অর্ডার করতে ভিজিট করুন টুলপত্র: https://toolpotro.com',
        linkPlacementRule: 'ডেসক্রিপশনের শীর্ষে https://toolpotro.com লিংক রাখুন।',
        hashtags: ['#Toolpotro', '#টুলপত্র', '#ProductReview', '#UnboxingBD'],
        audioRule: 'প্রথম ২০ সেকেন্ডে টুলপত্রের পণ্যের প্রশংসা করুন।',
        linkUrl: 'https://toolpotro.com',
      },
      facebook: {
        captionText:
          'দারুণ কোয়ালিটি ও দ্রুত ডেলিভারির জন্য অর্ডার করুন টুলপত্রে! লিংক কমেন্টে রয়েছে: https://toolpotro.com',
        pinnedCommentRule: 'প্রথম কমেন্টে বা ক্যাপশনে https://toolpotro.com লিংক পিন করুন।',
        tags: ['Toolpotro', 'টুলপত্র', 'UnboxingBD'],
        captionOrDescription:
          'দারুণ কোয়ালিটি ও দ্রুত ডেলিভারির জন্য অর্ডার করুন টুলপত্রে! লিংক কমেন্টে রয়েছে: https://toolpotro.com',
        linkPlacementRule: 'প্রথম কমেন্টে বা ক্যাপশনে https://toolpotro.com লিংক পিন করুন।',
        hashtags: ['#Toolpotro', '#টুলপত্র', '#ProductReview', '#FacebookReels'],
        audioRule: 'ভিডিওর প্রথম ২০ সেকেন্ডে বলুন প্রোডাক্টটি টুলপত্র থেকেই নিচ্ছি।',
        linkUrl: 'https://toolpotro.com',
      },
      tiktok: {
        captionText: 'প্রিমিয়াম পণ্যের নির্ভরযোগ্য ঠিকানা টুলপত্র ✨ লিংক বায়োতে!',
        bioLinkRule: 'প্রোফাইল বায়োতে toolpotro.com লিংক রাখুন।',
        tags: ['Toolpotro', 'টুলপত্র', 'TikTokShopBD'],
        captionOrDescription: 'প্রিমিয়াম পণ্যের নির্ভরযোগ্য ঠিকানা টুলপত্র ✨ লিংক বায়োতে!',
        linkPlacementRule: 'প্রোফাইল বায়োতে toolpotro.com লিংক রাখুন।',
        hashtags: ['#Toolpotro', '#টুলপত্র', '#ProductReview', '#TikTokBD'],
        audioRule: 'শুরুতেই টুলপত্রের কথা উচ্চারণ করুন।',
        linkUrl: 'https://toolpotro.com',
      },
      instagram: {
        captionText: 'টুলপত্রের স্পেশাল কালেকশন এখন হাতের নাগালে ✨ অর্ডার লিংক বায়োতে!',
        bioLinkRule: 'বায়ো অথবা স্টোরি লিংক স্টিকারে https://toolpotro.com ব্যবহার করুন।',
        tags: ['Toolpotro', 'টুলপত্র', 'InstaBD'],
        captionOrDescription:
          'টুলপত্রের স্পেশাল কালেকশন এখন হাতের নাগালে ✨ অর্ডার লিংক বায়োতে: https://toolpotro.com',
        linkPlacementRule: 'বায়ো অথবা স্টোরি লিংক স্টিকারে https://toolpotro.com ব্যবহার করুন।',
        hashtags: ['#Toolpotro', '#টুলপত্র', '#ProductReview', '#InstaBD'],
        audioRule: 'প্রথম ২০ সেকেন্ডে টুলপত্রের নাম উচ্চারণ করুন।',
        linkUrl: 'https://toolpotro.com',
      },
    },
  },
  {
    id: 'toolpotro-first-order-promo',
    title: 'টুলপত্রে ১ম অর্ডারে ১০০ টাকা ছাড় ভাউচার প্রোমো',
    description:
      'নতুন গ্রাহকদের জন্য টুলপত্রে ১০০ টাকা ছাড় ভাউচার কোড TOOLPOTRO100 প্রচার করে আকর্ষণীয় ভিডিও তৈরি করুন।',
    commonGuideline:
      '১. ওয়েবসাইট বা অ্যাপ ইন্টারফেস দেখিয়ে দর্শকদের জানান কিভাবে অর্ডার করতে হয়।\n২. চেকআউট পেজে ভাউচার কোড "TOOLPOTRO100" ব্যবহার করে ১০০ টাকা ছাড় পাওয়ার প্রক্রিয়া দেখান।\n৩. ভিডিওর টেক্সটে ভাউচার কোডটি স্পষ্টভাবে লিখে দিন।',
    brandName: 'Toolpotro',
    brandKeywords: ['Toolpotro', 'টুলপত্র', 'Toolpotro Voucher', 'TOOLPOTRO100'],
    hashtags: ['#Toolpotro', '#DiscountCode', '#টুলপত্র', '#SaveMoney'],
    scriptGuide:
      '১. ওয়েবসাইট বা অ্যাপ ইন্টারফেস দেখিয়ে দর্শকদের জানান কিভাবে অর্ডার করতে হয়।\n২. চেকআউট পেজে ভাউচার কোড "TOOLPOTRO100" ব্যবহার করে ১০০ টাকা ছাড় পাওয়ার প্রক্রিয়া দেখান।\n৩. ভিডিওর টেক্সটে ভাউচার কোডটি স্পষ্টভাবে লিখে দিন।',
    requiredDialogues:
      'প্রথম ১৫ সেকেন্ডে বলুন: "টুলপত্র থেকে অর্ডার করার সময় কোড TOOLPOTRO100 ব্যবহার করলেই পাচ্ছেন প্রথম অর্ডারে ১০০ টাকা ছাড়!"',
    cpmRate: 250,
    validationMode: 'first_30s',
    minViews: 1500,
    minLikeRatio: 0.038,
    minCommentRatio: 0.004,
    maxPayoutPerVideo: 30000,
    endDate: '2026-11-15',
    category: 'স্পেশাল ডিসকাউন্ট অফার',
    bannerGradient: 'from-purple-600 via-indigo-600 to-blue-700',
    isActive: true,
    status: 'active',
    createdAt: new Date().toISOString(),
    createdBy: 'anglaranni66@gmail.com',
    platformGuidelines: {
      youtube: {
        titleRule: 'টুলপত্রে প্রথম অর্ডারে ১০০ টাকা ছাড়! | কোড: TOOLPOTRO100',
        descriptionRule:
          'টুলপত্রে ১ম অর্ডারে ১০০ টাকা ইনস্ট্যান্ট ছাড় পেতে ভাউচার কোড TOOLPOTRO100 ব্যবহার করুন! লিংক: https://toolpotro.com',
        tags: ['Toolpotro Voucher', 'টুলপত্র ভাউচার কোড', 'TOOLPOTRO100'],
        titleKeywords: ['Toolpotro Voucher', 'টুলপত্র ভাউচার কোড', 'TOOLPOTRO100'],
        captionOrDescription:
          'টুলপত্রে ১ম অর্ডারে ১০০ টাকা ইনস্ট্যান্ট ছাড় পেতে ভাউচার কোড TOOLPOTRO100 ব্যবহার করুন! অর্ডার লিংক: https://toolpotro.com',
        linkPlacementRule: 'ডেসক্রিপশনের প্রথম লাইনে https://toolpotro.com লিংক রাখুন।',
        hashtags: ['#Toolpotro', '#DiscountCode', '#টুলপত্র', '#SaveMoney'],
        audioRule: 'প্রথম ১৫ সেকেন্ডে ভাউচার কোড TOOLPOTRO100 স্পষ্টভাবে বলুন।',
        linkUrl: 'https://toolpotro.com',
      },
      facebook: {
        captionText:
          'প্রথম অর্ডারে ১০০ টাকা ছাড়! টুলপত্রে কোড TOOLPOTRO100 ব্যবহার করুন। লিঙ্ক নিচে কমেন্টে দেওয়া আছে 👇',
        pinnedCommentRule: 'প্রথম কমেন্ট ও ক্যাপশনে https://toolpotro.com দিন।',
        tags: ['Toolpotro', 'TOOLPOTRO100', 'টুলপত্র ছাড়'],
        captionOrDescription:
          'প্রথম অর্ডারে ১০০ টাকা ছাড়! টুলপত্রে কোড TOOLPOTRO100 ব্যবহার করুন। লিঙ্ক নিচে কমেন্টে দেওয়া আছে 👇 https://toolpotro.com',
        linkPlacementRule: 'প্রথম কমেন্ট ও ক্যাপশনে https://toolpotro.com দিন।',
        hashtags: ['#Toolpotro', '#DiscountCode', '#টুলপত্র', '#FacebookReels'],
        audioRule: 'ভিডিওতে প্রথম ১৫ সেকেন্ডে ভাউচার কোড বলুন।',
        linkUrl: 'https://toolpotro.com',
      },
      tiktok: {
        captionText: 'টুলপত্রে ১ম অর্ডারে ১০০ টাকা ছাড় নিতে কোড TOOLPOTRO100 অ্যাপ্লাই করুন 🚀 লিংক বায়োতে!',
        bioLinkRule: 'বায়োতে বা ক্যাপশনে toolpotro.com লিংক রাখুন।',
        tags: ['Toolpotro', 'DiscountCode', 'TOOLPOTRO100'],
        captionOrDescription: 'টুলপত্রে ১ম অর্ডারে ১০০ টাকা ছাড় নিতে কোড TOOLPOTRO100 অ্যাপ্লাই করুন 🚀 লিংক বায়োতে!',
        linkPlacementRule: 'বায়োতে বা ক্যাপশনে toolpotro.com লিংক রাখুন।',
        hashtags: ['#Toolpotro', '#DiscountCode', '#টুলপত্র', '#TikTokBangladesh'],
        audioRule: 'প্রথম ১৫ সেকেন্ডে টুলপত্র ও ভাউচার কোডের নাম বলুন।',
        linkUrl: 'https://toolpotro.com',
      },
      instagram: {
        captionText: '১০০ টাকা ইনস্ট্যান্ট ছাড় পেতে টুলপত্র ভিজিট করুন এবং কোড TOOLPOTRO100 ব্যবহার করুন! লিংক বায়ো ও স্টোরিতে ✨',
        bioLinkRule: 'বায়ো লিংক অথবা স্টোরি লিংক স্টিকারে https://toolpotro.com ব্যবহার করুন।',
        tags: ['Toolpotro', 'TOOLPOTRO100', 'InstaDhaka'],
        captionOrDescription:
          '১০০ টাকা ইনস্ট্যান্ট ছাড় পেতে টুলপত্র ভিজিট করুন এবং কোড TOOLPOTRO100 ব্যবহার করুন! লিংক বায়ো ও স্টোরিতে ✨',
        linkPlacementRule: 'বায়ো লিংক অথবা স্টোরি লিংক স্টিকারে https://toolpotro.com ব্যবহার করুন।',
        hashtags: ['#Toolpotro', '#DiscountCode', '#টুলপত্র', '#InstagramReels'],
        audioRule: 'প্রথম ১৫ সেকেন্ডে টুলপত্র ও ভাউচার কোড বলুন।',
        linkUrl: 'https://toolpotro.com',
      },
    },
  },
];

export const memoryStore = {
  campaigns: new Map<string, CampaignRecord>(initialCampaigns.map((c) => [c.id, c])),
  submissions: new Map<string, SubmissionRecord>(),
  users: new Map<string, UserWalletRecord>(),
  adminEmails: new Set<string>(['anglaranni66@gmail.com', 'admin@toolpotro.com']),
};

// Atomic file-backed durable ledger so queued submissions, wallet balances, and campaigns survive restarts/sleep
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(process.cwd(), '.data');
const STORE_FILE = path.join(DATA_DIR, 'toolpotro-store.json');

interface SerializedStore {
  campaigns: CampaignRecord[];
  submissions: SubmissionRecord[];
  users: UserWalletRecord[];
  savedAt: string;
}

export function loadPersistentStore(): void {
  try {
    if (!fs.existsSync(STORE_FILE)) {
      persistStore();
      return;
    }
    const raw = fs.readFileSync(STORE_FILE, 'utf-8');
    if (!raw.trim()) return;
    const parsed: SerializedStore = JSON.parse(raw);

    if (Array.isArray(parsed.campaigns) && parsed.campaigns.length > 0) {
      memoryStore.campaigns.clear();
      for (const c of parsed.campaigns) {
        if (c && c.id) memoryStore.campaigns.set(c.id, c);
      }
    }
    if (Array.isArray(parsed.submissions)) {
      memoryStore.submissions.clear();
      for (const s of parsed.submissions) {
        if (s && s.id) memoryStore.submissions.set(s.id, s);
      }
    }
    if (Array.isArray(parsed.users)) {
      memoryStore.users.clear();
      for (const u of parsed.users) {
        if (u && u.id) memoryStore.users.set(u.id, u);
      }
    }

    console.log(
      `[PersistentStore] Loaded ${memoryStore.campaigns.size} campaigns, ${memoryStore.submissions.size} submissions, ${memoryStore.users.size} users.`
    );
  } catch (err) {
    console.error('[PersistentStore] Failed loading persistent store:', err);
  }
}

export function persistStore(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const payload: SerializedStore = {
      campaigns: Array.from(memoryStore.campaigns.values()),
      submissions: Array.from(memoryStore.submissions.values()),
      users: Array.from(memoryStore.users.values()),
      savedAt: new Date().toISOString(),
    };
    const tempPath = `${STORE_FILE}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), 'utf-8');
    fs.renameSync(tempPath, STORE_FILE);
  } catch (err) {
    console.error('[PersistentStore] Failed saving persistent store:', err);
  }
}

export function getPlatformGuidelineKey(
  platform: SubmissionRecord['platform']
): keyof PlatformGuidelinesMap {
  if (platform === 'youtube_shorts') return 'youtube';
  if (platform === 'facebook_reels') return 'facebook';
  if (platform === 'instagram') return 'instagram';
  return 'tiktok';
}
