import { GoogleGenAI, Type } from '@google/genai';
import {
  CampaignRecord,
  FallbackReason,
  PlatformGuideline,
  getPlatformGuidelineKey,
  SubmissionRecord,
} from '../config/firebaseAdmin.js';

export interface GeminiVerificationResult {
  keyword_found: boolean;
  dialogue_matched: boolean;
  caption_matched: boolean;
  description_or_link_matched: boolean;
  confidence_score: number;
  status_reason: string;
  detected_keywords: string[];
  transcript_summary: string;
  audio_quality: 'clear' | 'noisy' | 'muffled' | 'inaudible' | 'unavailable';
  is_bot_comment_spam: boolean;
  comment_quality_analysis: string;
  category_routing: 'category_a_approved' | 'category_b_rejected' | 'category_c_review';
  apiError?: boolean;
  fallbackReason?: FallbackReason;
  errorDetail?: string;
  modelUsed: string;
  rawResponse?: string;
}

export function getActiveGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || 'gemini-3.1-flash-lite';
}

function getAiClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || '',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isApiKeyConfigured(): boolean {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  return Boolean(key && key !== 'MY_GEMINI_API_KEY' && key.length > 10);
}

/**
 * Dynamically verifies a creator's video against the EXACT campaign + platform criteria.
 * - Uses single balanced cost-efficient model (process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite')
 * - NEVER guesses or auto-approves/rejects on API quota limit (429), timeout, missing key, or unavailable audio.
 *   In all such cases, routes cleanly to "ম্যানুয়ালি যাচাই" (category_c_review) with exact fallbackReason & errorDetail.
 */
export async function verifyBrandingWithGemini(params: {
  videoTitle: string;
  videoDescription: string;
  videoPlatform: SubmissionRecord['platform'];
  videoUrl: string;
  campaign: CampaignRecord;
  timeWindowLabel: string;
  audioAvailable: boolean;
  audioBase64?: string;
  sampleComments?: string[];
  hasLiveMetrics: boolean;
  hasLiveText: boolean;
  fetchError?: string;
}): Promise<GeminiVerificationResult> {
  const {
    videoTitle,
    videoDescription,
    videoPlatform,
    videoUrl,
    campaign,
    timeWindowLabel,
    audioAvailable,
    audioBase64,
    sampleComments = [],
    hasLiveMetrics,
    hasLiveText,
    fetchError,
  } = params;

  const modelUsed = getActiveGeminiModel();
  const platformKey = getPlatformGuidelineKey(videoPlatform);
  const pg: PlatformGuideline | undefined = campaign.platformGuidelines?.[platformKey];

  const expectedCaptionOrTitleRule =
    pg?.titleRule || pg?.captionText || pg?.captionOrTitleRule || 'Must promote campaign topic clearly';
  const expectedDescOrCommentRule =
    pg?.descriptionRule ||
    pg?.pinnedCommentRule ||
    pg?.bioLinkRule ||
    pg?.descriptionOrCommentRule ||
    pg?.captionOrDescription ||
    '';
  const expectedLinkUrl = pg?.linkUrl || '';
  const platformTags = pg?.tags || pg?.keywords || pg?.titleKeywords || [];
  const platformHashtags = pg?.hashtags || campaign.hashtags || [];
  const spokenDialogueRule = pg?.audioRule || campaign.requiredDialogues || '';
  const universalRule = campaign.commonGuideline || campaign.scriptGuide || '';

  const allTargetKeywords = Array.from(
    new Set([campaign.brandName, ...(campaign.brandKeywords || []), ...platformTags])
  ).filter(Boolean);

  // If live text AND audio are both missing, AI has nothing real to inspect -> route straight to Manual Review!
  if (!hasLiveText && !audioAvailable) {
    return {
      keyword_found: false,
      dialogue_matched: false,
      caption_matched: false,
      description_or_link_matched: false,
      confidence_score: 0,
      status_reason:
        fetchError ||
        'ভিডিওর ক্যাপশন, ডেসক্রিপশন ও অডিও অটোমেটিকভাবে সংগ্রহ করা যায়নি। ভুল যাচাই এড়াতে ম্যানুয়াল যাচাইয়ে পাঠানো হয়েছে।',
      detected_keywords: [],
      transcript_summary: 'লাইভ ভিডিও টেক্সট ও অডিও অনুপলব্ধ থাকায় ম্যানুয়ালি যাচাই প্রয়োজন।',
      audio_quality: 'unavailable',
      is_bot_comment_spam: false,
      comment_quality_analysis: 'অটো-ফেচ অনুপলব্ধ।',
      category_routing: 'category_c_review',
      apiError: false,
      fallbackReason: 'metadata_fetch_unavailable',
      errorDetail: fetchError || 'Metadata & audio stream unavailable from platform.',
      modelUsed,
    };
  }

  // If Gemini API Key is not configured on Render yet -> NEVER fake pass/reject; send straight to Manual Review!
  if (!isApiKeyConfigured()) {
    return {
      keyword_found: false,
      dialogue_matched: false,
      caption_matched: false,
      description_or_link_matched: false,
      confidence_score: 0,
      status_reason:
        'GEMINI_API_KEY সেট করা নেই — এআই যাচাই না করে নিরাপদভাবে "ম্যানুয়ালি যাচাই" তালিকায় পাঠানো হয়েছে।',
      detected_keywords: [],
      transcript_summary: 'GEMINI_API_KEY অনুপস্থিত।',
      audio_quality: audioAvailable ? 'clear' : 'unavailable',
      is_bot_comment_spam: false,
      comment_quality_analysis: 'API Key সেট করার পর "আবার AI দিয়ে যাচাই করুন" ব্যবহার করতে পারবেন।',
      category_routing: 'category_c_review',
      apiError: true,
      fallbackReason: 'api_limit_or_error',
      errorDetail: 'GEMINI_API_KEY missing or placeholder in server environment.',
      modelUsed,
    };
  }

  const systemInstruction = `
You are a strict, zero-hallucination UGC Compliance Auditor.
You MUST evaluate ONLY against the specific Campaign & Platform criteria provided below—never assume any external brand rules.
CRITICAL RULES:
1. If audio is provided, transcribe ONLY what is genuinely heard in the audio clip (${timeWindowLabel}) into transcript_summary, and verify if the Campaign Spoken Dialogue requirement was actually spoken.
2. If NO audio is provided (audioAvailable=false), explicitly set dialogue_matched=false and note that audio stream was unavailable—NEVER invent a spoken transcript!
3. Check whether the fetched video title/caption satisfies the Platform Title/Caption rule.
4. Check whether the fetched description/comments contain the required Official Link (${expectedLinkUrl || 'none specified'}) and Platform Description/Link rule.
5. Analyze sample comments for bot spam vs organic human questions.
6. Set confidence_score conservatively (0-100): only >= 80 if you clearly verified the required rules from real evidence.
`;

  const userPrompt = `
=== CAMPAIGN CRITERIA (DYNAMIC FROM ADMIN) ===
Campaign Title: ${campaign.title}
Brand Name: ${campaign.brandName}
Universal Guideline (Condition 1): ${universalRule}
Spoken Audio Dialogue Rule (${timeWindowLabel}): ${spokenDialogueRule}
Validation Mode: ${campaign.validationMode}
Target Keywords / Tags: ${allTargetKeywords.join(', ')}
Admin Saved Hashtags: ${platformHashtags.join(', ')}

=== PLATFORM SPECIFIC RULES (${videoPlatform}) ===
Expected Title / Caption Guideline (Condition 2): ${expectedCaptionOrTitleRule}
Expected Description / Pinned Comment / Bio Rule (Condition 3): ${expectedDescOrCommentRule}
Expected Official Link: ${expectedLinkUrl || 'Not specified'}

=== REAL FETCHED VIDEO DATA ===
Video URL: ${videoUrl}
Fetched Title / Caption: ${videoTitle || '(Not fetched)'}
Fetched Description: ${videoDescription || '(Not fetched)'}
Live Metrics Available: ${hasLiveMetrics ? 'YES' : 'NO'}
Audio Clip Attached: ${audioAvailable ? `YES (${timeWindowLabel})` : 'NO (Audio stream unavailable)'}
Sample Comments: ${sampleComments.length > 0 ? sampleComments.slice(0, 5).join(' | ') : 'None fetched'}
`;

  try {
    const ai = getAiClient();
    const parts: any[] = [{ text: userPrompt }];

    if (audioAvailable && audioBase64) {
      parts.push({
        inlineData: {
          mimeType: 'audio/wav',
          data: audioBase64,
        },
      });
    }

    const generatePromise = ai.models.generateContent({
      model: modelUsed,
      contents: { parts },
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            keyword_found: {
              type: Type.BOOLEAN,
              description: 'Whether target campaign keywords/brand were clearly verified',
            },
            dialogue_matched: {
              type: Type.BOOLEAN,
              description: 'Whether the exact spoken dialogue rule was heard in the audio clip (false if no audio)',
            },
            caption_matched: {
              type: Type.BOOLEAN,
              description: 'Whether the fetched video title/caption satisfies the platform guideline',
            },
            description_or_link_matched: {
              type: Type.BOOLEAN,
              description: 'Whether description/links meet the platform description/link requirement',
            },
            confidence_score: {
              type: Type.NUMBER,
              description: 'Strict evidence-based confidence score from 0 to 100',
            },
            status_reason: {
              type: Type.STRING,
              description: 'Clear explanation in Bengali or English summarizing exact verification findings',
            },
            detected_keywords: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Keywords/hashtags verified in the video',
            },
            transcript_summary: {
              type: Type.STRING,
              description: 'Exact transcript heard in the audio clip, or "অডিও ক্লিপ পাওয়া যায়নি" if unavailable',
            },
            audio_quality: {
              type: Type.STRING,
              description: 'clear, noisy, muffled, inaudible, or unavailable',
            },
            is_bot_comment_spam: {
              type: Type.BOOLEAN,
              description: 'Whether comments indicate automated bot spam',
            },
            comment_quality_analysis: {
              type: Type.STRING,
              description: 'Short assessment of comment authenticity',
            },
          },
          required: [
            'keyword_found',
            'dialogue_matched',
            'caption_matched',
            'description_or_link_matched',
            'confidence_score',
            'status_reason',
            'detected_keywords',
            'transcript_summary',
            'audio_quality',
            'is_bot_comment_spam',
            'comment_quality_analysis',
          ],
        },
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini API call timed out after 15 seconds')), 15000)
    );

    const response = await Promise.race([generatePromise, timeoutPromise]);
    const text = (response.text ?? '{}').trim();
    const parsed = JSON.parse(text);

    const confidence = typeof parsed.confidence_score === 'number' ? parsed.confidence_score : 0;
    const keywordFound = Boolean(parsed.keyword_found);
    const dialogueMatched = audioAvailable ? Boolean(parsed.dialogue_matched) : false;
    const captionMatched = Boolean(parsed.caption_matched);
    const descMatched = Boolean(parsed.description_or_link_matched);
    const audioQuality = ['clear', 'noisy', 'muffled', 'inaudible', 'unavailable'].includes(parsed.audio_quality)
      ? parsed.audio_quality
      : audioAvailable
        ? 'clear'
        : 'unavailable';

    // Safety routing:
    // - If spoken dialogue could not be verified because audio stream wasn't extracted -> NEVER auto-reject/auto-approve; send to Manual Review!
    // - If live metrics were unavailable -> ALWAYS send to Manual Review so views aren't evaluated as 0!
    let routing: 'category_a_approved' | 'category_b_rejected' | 'category_c_review' = 'category_c_review';
    let fallbackReason: FallbackReason | undefined;

    if (!hasLiveMetrics) {
      routing = 'category_c_review';
      fallbackReason = 'metadata_fetch_unavailable';
    } else if (!audioAvailable) {
      routing = 'category_c_review';
      fallbackReason = 'audio_unavailable_for_ai';
    } else if (!keywordFound && !dialogueMatched && confidence <= 25) {
      routing = 'category_b_rejected';
    } else if (
      keywordFound &&
      dialogueMatched &&
      confidence >= 80 &&
      audioQuality === 'clear' &&
      !parsed.is_bot_comment_spam
    ) {
      routing = 'category_a_approved';
    } else {
      routing = 'category_c_review';
      fallbackReason = audioQuality !== 'clear' ? 'noisy_audio' : 'low_confidence';
    }

    return {
      keyword_found: keywordFound,
      dialogue_matched: dialogueMatched,
      caption_matched: captionMatched,
      description_or_link_matched: descMatched,
      confidence_score: confidence,
      status_reason: parsed.status_reason || 'Gemini AI যাচাই সম্পন্ন হয়েছে।',
      detected_keywords: Array.isArray(parsed.detected_keywords) ? parsed.detected_keywords : [],
      transcript_summary:
        parsed.transcript_summary || (audioAvailable ? 'অডিও ট্রান্সক্রিপশন সম্পন্ন' : 'অডিও স্ট্রিম পাওয়া যায়নি'),
      audio_quality: audioQuality as GeminiVerificationResult['audio_quality'],
      is_bot_comment_spam: Boolean(parsed.is_bot_comment_spam),
      comment_quality_analysis: parsed.comment_quality_analysis || 'কমেন্ট পর্যালোচনা সম্পন্ন।',
      category_routing: routing,
      apiError: false,
      fallbackReason,
      modelUsed,
      rawResponse: text,
    };
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    console.error('[GeminiService] API limit/error — routing safely to Manual Review (NEVER rejecting):', errMsg);

    // CRITICAL: When Gemini API hits quota limit (429), timeout, 403/404, or network failure:
    // NEVER reject or blindly approve! Route straight to "ম্যানুয়ালি যাচাই" with apiError=true.
    return {
      keyword_found: false,
      dialogue_matched: false,
      caption_matched: false,
      description_or_link_matched: false,
      confidence_score: 0,
      status_reason: `Gemini API এরর/লিমিটের কারণে (${errMsg.slice(0, 120)}) অটো-যাচাই স্থগিত — "ম্যানুয়ালি যাচাই" ট্যাবে পাঠানো হয়েছে।`,
      detected_keywords: [],
      transcript_summary: 'AI API সমস্যার কারণে ম্যানুয়ালি যাচাইয়ের জন্য অপেক্ষমান।',
      audio_quality: audioAvailable ? 'clear' : 'unavailable',
      is_bot_comment_spam: false,
      comment_quality_analysis: 'API স্বাভাবিক হলে অ্যাডমিন "সবগুলো একসাথে AI যাচাইয়ে পাঠান" দিয়ে পুনরায় চেক করতে পারবেন।',
      category_routing: 'category_c_review',
      apiError: true,
      fallbackReason: 'api_limit_or_error',
      errorDetail: errMsg,
      modelUsed,
    };
  }
}
