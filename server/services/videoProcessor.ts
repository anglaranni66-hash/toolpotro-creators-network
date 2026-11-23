import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execFileAsync = promisify(execFile);

export interface AudioProcessingResult {
  success: boolean;
  audioAvailable: boolean;
  ruleApplied: 'first_30s' | 'full_script';
  startSeconds: number;
  durationSeconds: number;
  timeWindowLabel: string;
  audioBase64?: string;
  transcriptSample?: string;
  isNoiseFiltered: boolean;
  error?: string;
}

function normalizeBengaliDigits(input: string): string {
  const bn = '০১২৩৪৫৬৭৮৯';
  return input.replace(/[০-৯]/g, (d) => String(bn.indexOf(d)));
}

/**
 * Parses exact spoken time window from campaign dialogue/audio rule (e.g. "15-20 সেকেন্ড", "1-15s", "প্রথম ২০ সেকেন্ড").
 * Adds a small +/- 2s safety buffer so boundary words aren't accidentally clipped.
 */
export function parseAudioTimeWindow(
  validationMode: 'first_30s' | 'full_script',
  dialogueRule?: string,
  platformAudioRule?: string
): { startSeconds: number; durationSeconds: number; label: string } {
  const combined = normalizeBengaliDigits(`${platformAudioRule || ''} ${dialogueRule || ''}`);

  // Match range like "15-20", "15 to 20", "1-15", "15–30"
  const rangeMatch = combined.match(/(\d{1,3})\s*(?:-|–|থেকে|to)\s*(\d{1,3})\s*(?:সেকেন্ড|sec|s\b)/i);
  if (rangeMatch) {
    const rawStart = Math.max(0, Number(rangeMatch[1]));
    const rawEnd = Math.max(rawStart + 1, Number(rangeMatch[2]));
    const bufferedStart = Math.max(0, rawStart - 2);
    const bufferedDuration = Math.min(180, rawEnd - bufferedStart + 2);
    return {
      startSeconds: bufferedStart,
      durationSeconds: bufferedDuration,
      label: `${rawStart}-${rawEnd} সেকেন্ড`,
    };
  }

  // Match single "প্রথম X সেকেন্ড" or "first X seconds"
  const firstMatch = combined.match(/(?:প্রথম|first|within)\s*(\d{1,3})\s*(?:সেকেন্ড|sec|s\b)/i);
  if (firstMatch) {
    const end = Math.min(180, Math.max(5, Number(firstMatch[1])));
    return {
      startSeconds: 0,
      durationSeconds: end + 2,
      label: `০-${end} সেকেন্ড`,
    };
  }

  if (validationMode === 'full_script') {
    return { startSeconds: 0, durationSeconds: 180, label: 'সম্পূর্ণ স্ক্রিপ্ট (১৮০ সেকেন্ড পর্যন্ত)' };
  }

  return { startSeconds: 0, durationSeconds: 32, label: 'প্রথম ৩০ সেকেন্ড' };
}

/**
 * Validates and sanitizes a URL against SSRF, command injection, and enforces VIDEO-ONLY links.
 */
export function sanitizeVideoUrl(rawUrl: string): {
  isValid: boolean;
  sanitizedUrl?: string;
  error?: string;
  isVideoOnly?: boolean;
} {
  try {
    const parsed = new URL(rawUrl.trim());

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { isValid: false, error: 'Only secure HTTP/HTTPS video URLs are allowed.' };
    }

    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname;

    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '169.254.169.254' ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local')
    ) {
      return { isValid: false, error: 'Invalid hostname: loopback or metadata service access rejected.' };
    }

    const isPrivateIp = /^((10\.)|(172\.(1[6-9]|2[0-9]|3[01])\.)|(192\.168\.))/.test(hostname);
    if (isPrivateIp) {
      return { isValid: false, error: 'Internal network addresses are strictly forbidden.' };
    }

    const isYoutube = hostname.includes('youtube.com') || hostname.includes('youtu.be');
    const isFacebook = hostname.includes('facebook.com') || hostname.includes('fb.watch') || hostname.includes('fb.gg');
    const isTikTok = hostname.includes('tiktok.com');
    const isInstagram = hostname.includes('instagram.com');

    if (!isYoutube && !isFacebook && !isTikTok && !isInstagram) {
      return { isValid: false, error: 'URL must be a video from YouTube, Facebook, TikTok, or Instagram.' };
    }

    if (isYoutube) {
      const isShort = pathname.includes('/shorts/');
      const isWatch = pathname.includes('/watch') || parsed.searchParams.has('v');
      const isYoutuBe = hostname.includes('youtu.be') && pathname.length > 2;

      if (!isShort && !isWatch && !isYoutuBe) {
        return {
          isValid: false,
          error: 'Rejected: Link is a YouTube channel or profile homepage. Please provide a valid YouTube Shorts or Video URL.',
        };
      }
    } else if (isFacebook) {
      const isReel = pathname.includes('/reel/') || pathname.includes('/reels/');
      const isVideo = pathname.includes('/videos/') || pathname.includes('/watch');
      const isFbWatch = hostname.includes('fb.watch');

      if (pathname.includes('/photo') || pathname.includes('/photos/') || pathname.includes('/posts/')) {
        return {
          isValid: false,
          error: 'Rejected: Static photo posts and text statuses are not eligible. Only video reels/videos are accepted.',
        };
      }

      if (!isReel && !isVideo && !isFbWatch) {
        return {
          isValid: false,
          error: 'Rejected: Please provide a direct Facebook Reel or Video link.',
        };
      }
    } else if (isTikTok) {
      const isVideo = pathname.includes('/video/') || pathname.includes('/v/');
      if (!isVideo) {
        return {
          isValid: false,
          error: 'Rejected: TikTok user profile link detected. Please submit a direct TikTok video link.',
        };
      }
    } else if (isInstagram) {
      const isReel = pathname.includes('/reel/') || pathname.includes('/reels/');
      const isPost = pathname.includes('/p/') || pathname.includes('/tv/');

      if (!isReel && !isPost) {
        return {
          isValid: false,
          error: 'Rejected: Instagram user profile link detected. Please submit an Instagram Reel link.',
        };
      }
    }

    return { isValid: true, sanitizedUrl: parsed.toString(), isVideoOnly: true };
  } catch {
    return { isValid: false, error: 'Malformed video URL format.' };
  }
}

function isSafeHttpMediaUrl(candidate?: string): boolean {
  if (!candidate) return false;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    const h = parsed.hostname.toLowerCase();
    if (
      h === 'localhost' ||
      h === '127.0.0.1' ||
      h === '::1' ||
      h === '169.254.169.254' ||
      /^((10\.)|(172\.(1[6-9]|2[0-9]|3[01])\.)|(192\.168\.))/.test(h)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Extracts real audio clip ONLY for the campaign's requested time window using directMediaUrl or yt-dlp + FFmpeg.
 * NEVER fabricates dummy audio tones: if live audio extraction is unavailable, marks audioAvailable=false.
 */
export async function processVideoAudio(
  videoUrl: string,
  validationMode: 'first_30s' | 'full_script',
  dialogueRule?: string,
  platformAudioRule?: string,
  directMediaUrl?: string
): Promise<AudioProcessingResult> {
  const timeWindow = parseAudioTimeWindow(validationMode, dialogueRule, platformAudioRule);
  const sanitizeCheck = sanitizeVideoUrl(videoUrl);

  if (!sanitizeCheck.isValid || !sanitizeCheck.sanitizedUrl) {
    return {
      success: false,
      audioAvailable: false,
      ruleApplied: validationMode,
      startSeconds: timeWindow.startSeconds,
      durationSeconds: timeWindow.durationSeconds,
      timeWindowLabel: timeWindow.label,
      isNoiseFiltered: false,
      error: sanitizeCheck.error || 'Invalid video URL',
    };
  }

  const tempDir = os.tmpdir();
  const outputFileName = `toolpotro_audio_${Date.now()}_${Math.random().toString(36).substring(7)}.wav`;
  const outputPath = path.join(tempDir, outputFileName);

  try {
    let mediaStreamUrl = isSafeHttpMediaUrl(directMediaUrl) ? directMediaUrl : '';

    // 1. If Apify didn't provide a direct stream URL, resolve via yt-dlp
    if (!mediaStreamUrl) {
      const { stdout: streamOut } = await execFileAsync(
        'yt-dlp',
        ['-f', 'bestaudio/best', '-g', '--no-warnings', '--no-playlist', sanitizeCheck.sanitizedUrl],
        { timeout: 15000 }
      );
      mediaStreamUrl = streamOut.trim().split('\n')[0]?.trim() || '';
    }

    if (!mediaStreamUrl || !mediaStreamUrl.startsWith('http')) {
      throw new Error('Could not resolve direct media audio stream URL.');
    }

    // 2. Cut exact time window with FFmpeg & isolate speech frequencies (-vn downloads NO video pixels)
    const ffmpegArgs = [
      '-y',
      '-ss',
      timeWindow.startSeconds.toString(),
      '-i',
      mediaStreamUrl,
      '-t',
      timeWindow.durationSeconds.toString(),
      '-vn',
      '-af',
      'highpass=f=200,lowpass=f=3000,volume=1.2',
      '-ar',
      '16000',
      '-ac',
      '1',
      outputPath,
    ];

    await execFileAsync('ffmpeg', ffmpegArgs, { timeout: 25000 });

    let audioBuffer: Buffer | null = null;
    if (fs.existsSync(outputPath)) {
      audioBuffer = fs.readFileSync(outputPath);
      try {
        fs.unlinkSync(outputPath);
      } catch {
        // ignore cleanup error
      }
    }

    if (!audioBuffer || audioBuffer.length < 1000) {
      throw new Error('Extracted audio file is empty.');
    }

    return {
      success: true,
      audioAvailable: true,
      ruleApplied: validationMode,
      startSeconds: timeWindow.startSeconds,
      durationSeconds: timeWindow.durationSeconds,
      timeWindowLabel: timeWindow.label,
      audioBase64: audioBuffer.toString('base64'),
      isNoiseFiltered: true,
      transcriptSample: `Real audio slice extracted (${timeWindow.label}) with speech bandpass filter.`,
    };
  } catch (err: any) {
    if (fs.existsSync(outputPath)) {
      try {
        fs.unlinkSync(outputPath);
      } catch {
        // ignore
      }
    }
    const reason = err?.message || 'yt-dlp/FFmpeg unavailable for live stream extraction';
    console.warn(`[VideoProcessor] Audio extraction unavailable (${timeWindow.label}):`, reason);

    return {
      success: false,
      audioAvailable: false,
      ruleApplied: validationMode,
      startSeconds: timeWindow.startSeconds,
      durationSeconds: timeWindow.durationSeconds,
      timeWindowLabel: timeWindow.label,
      isNoiseFiltered: false,
      error: reason,
    };
  }
}
