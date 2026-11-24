export type Platform = 'youtube' | 'spotify' | 'instagram';

export type PlatformFilter = Platform | 'all';

export type MediaKind = 'video' | 'audio';

export type MediaExtension = 'mp4' | 'mp3' | 'm4a';

export interface MediaFormatOption {
  id: string;
  label: string;
  kind: MediaKind;
  ext: MediaExtension;
  quality: string;
  sizeLabel: string;
  itag?: number;
  directUrl?: string;
}

export interface MediaInfo {
  id: string;
  url: string;
  canonicalUrl: string;
  platform: Platform;
  title: string;
  author: string;
  durationSec?: number;
  durationLabel: string;
  thumbnailUrl: string;
  formats: MediaFormatOption[];
  sourceNote?: string;
  matchedQuery?: string;
  streamable: boolean;
}

export type DownloadStatus = 'queued' | 'fetching' | 'converting' | 'completed' | 'error';

export interface DownloadJob {
  jobId: string;
  mediaId: string;
  url: string;
  platform: Platform;
  title: string;
  author: string;
  thumbnailUrl: string;
  format: MediaFormatOption;
  status: DownloadStatus;
  progress: number;
  createdAt: number;
  completedAt?: number;
  errorMessage?: string;
  downloadEndpoint: string;
  fileName: string;
}

export interface AppSettings {
  defaultVideoQuality: '1080p' | '720p' | '480p' | '360p';
  defaultAudioFormat: 'mp3' | 'm4a';
  autoClipboardHint: boolean;
  theme: 'system' | 'light' | 'dark';
}

export const DEFAULT_SETTINGS: AppSettings = {
  defaultVideoQuality: '720p',
  defaultAudioFormat: 'mp3',
  autoClipboardHint: true,
  theme: 'system',
};

export const PLATFORM_LABELS: Record<Platform, string> = {
  youtube: 'YouTube',
  spotify: 'Spotify',
  instagram: 'Instagram',
};

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
]);

const SPOTIFY_HOSTS = new Set(['open.spotify.com', 'spotify.link']);

const INSTAGRAM_HOSTS = new Set([
  'instagram.com',
  'www.instagram.com',
  'm.instagram.com',
  'instagr.am',
]);

const ALLOWED_MEDIA_EXACT_HOSTS = new Set([
  ...YOUTUBE_HOSTS,
  ...SPOTIFY_HOSTS,
  ...INSTAGRAM_HOSTS,
  'i.ytimg.com',
  'img.youtube.com',
  'yt3.ggpht.com',
  'i.scdn.co',
  'p.scdn.co',
  'mosaic.scdn.co',
  'image-cdn-ak.spotifycdn.com',
  'image-cdn-fa.spotifycdn.com',
]);

const ALLOWED_MEDIA_SUFFIXES = ['.googlevideo.com', '.cdninstagram.com', '.fbcdn.net', '.scdn.co'];

export function isPrivateOrLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true;
  }

  // IPv4 literal check
  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4Match) {
    const a = Number(ipv4Match[1]);
    const b = Number(ipv4Match[2]);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }

  // IPv6 private/link-local check
  if (host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:')) {
    return true;
  }

  return false;
}

export function isAllowedRemoteMediaHost(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    if (!host || isPrivateOrLoopbackHost(host)) {
      return false;
    }
    if (ALLOWED_MEDIA_EXACT_HOSTS.has(host)) {
      return true;
    }
    return ALLOWED_MEDIA_SUFFIXES.some((suffix) => host.endsWith(suffix));
  } catch {
    return false;
  }
}

export function detectPlatform(rawUrl: string): Platform | null {
  try {
    const trimmed = rawUrl.trim();
    if (!trimmed) return null;
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    const host = parsed.hostname.toLowerCase();
    if (YOUTUBE_HOSTS.has(host)) return 'youtube';
    if (SPOTIFY_HOSTS.has(host)) return 'spotify';
    if (INSTAGRAM_HOSTS.has(host)) return 'instagram';
    return null;
  } catch {
    return null;
  }
}

export function extractYouTubeId(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl.trim());
    const host = parsed.hostname.toLowerCase();
    if (!YOUTUBE_HOSTS.has(host)) return null;

    if (host === 'youtu.be') {
      const seg = parsed.pathname.split('/').filter(Boolean)[0];
      return seg && /^[a-zA-Z0-9_-]{11}$/.test(seg) ? seg : null;
    }

    const vParam = parsed.searchParams.get('v');
    if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) {
      return vParam;
    }

    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length >= 2 && ['shorts', 'embed', 'live', 'v'].includes(parts[0])) {
      return /^[a-zA-Z0-9_-]{11}$/.test(parts[1]) ? parts[1] : null;
    }

    return null;
  } catch {
    return null;
  }
}

export function extractSpotifyInfo(
  rawUrl: string
): { type: 'track' | 'album' | 'playlist' | 'episode'; id: string } | null {
  try {
    const parsed = new URL(rawUrl.trim());
    const host = parsed.hostname.toLowerCase();
    if (!SPOTIFY_HOSTS.has(host)) return null;

    const parts = parsed.pathname.split('/').filter(Boolean);
    // Support optional locale prefix like /intl-pt/track/...
    const filtered = parts[0]?.startsWith('intl-') ? parts.slice(1) : parts;
    if (filtered.length >= 2) {
      const kind = filtered[0];
      const id = filtered[1];
      if (
        (kind === 'track' || kind === 'album' || kind === 'playlist' || kind === 'episode') &&
        /^[a-zA-Z0-9]{10,40}$/.test(id)
      ) {
        return { type: kind, id };
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function extractInstagramShortcode(
  rawUrl: string
): { kind: 'reel' | 'p' | 'tv' | 'stories'; shortcode: string } | null {
  try {
    const parsed = new URL(rawUrl.trim());
    const host = parsed.hostname.toLowerCase();
    if (!INSTAGRAM_HOSTS.has(host)) return null;

    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length >= 2 && (parts[0] === 'reel' || parts[0] === 'reels' || parts[0] === 'p' || parts[0] === 'tv')) {
      const normalizedKind = parts[0] === 'reels' ? 'reel' : (parts[0] as 'reel' | 'p' | 'tv');
      const shortcode = parts[1];
      if (/^[a-zA-Z0-9_-]{5,40}$/.test(shortcode)) {
        return { kind: normalizedKind, shortcode };
      }
    }
    if (parts.length >= 3 && parts[0] === 'stories') {
      const shortcode = parts[2];
      if (/^[0-9]{5,30}$/.test(shortcode)) {
        return { kind: 'stories', shortcode };
      }
    }
    return null;
  } catch {
    return null;
  }
}

export interface UrlValidationResult {
  valid: boolean;
  normalizedUrl?: string;
  platform?: Platform;
  error?: string;
}

export function validateMediaUrl(
  rawUrl: string,
  expectedPlatform: PlatformFilter = 'all'
): UrlValidationResult {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return {
      valid: false,
      error: 'Cole um link do YouTube, Spotify ou Instagram para continuar.',
    };
  }

  let candidate = trimmed;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return {
      valid: false,
      error: 'Link inválido. Verifique o endereço colado e tente novamente.',
    };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      valid: false,
      error: 'Apenas links web (https://) são aceitos.',
    };
  }

  const detected = detectPlatform(parsed.toString());
  if (!detected) {
    return {
      valid: false,
      error: 'Plataforma não suportada. Use um link válido do YouTube, Spotify ou Instagram.',
    };
  }

  if (expectedPlatform !== 'all' && detected !== expectedPlatform) {
    return {
      valid: false,
      error: `Este link é do ${PLATFORM_LABELS[detected]}. Troque o filtro para "${PLATFORM_LABELS[detected]}" ou "Todos".`,
    };
  }

  if (detected === 'youtube' && !extractYouTubeId(parsed.toString())) {
    return {
      valid: false,
      error: 'Link do YouTube inválido. Use um link de vídeo, Shorts ou youtu.be.',
    };
  }

  if (detected === 'spotify' && parsed.hostname.toLowerCase() === 'open.spotify.com' && !extractSpotifyInfo(parsed.toString())) {
    return {
      valid: false,
      error: 'Link do Spotify inválido. Use um link de música, álbum ou episódio.',
    };
  }

  if (detected === 'instagram' && parsed.hostname.toLowerCase() !== 'instagr.am' && !extractInstagramShortcode(parsed.toString())) {
    return {
      valid: false,
      error: 'Link do Instagram inválido. Use um link de Reels, publicação (/p/) ou vídeo.',
    };
  }

  return {
    valid: true,
    normalizedUrl: parsed.toString(),
    platform: detected,
  };
}

export function formatDuration(seconds?: number): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) {
    return '—';
  }
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function formatFileSize(bytes?: number): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) {
    return 'Tamanho variável';
  }
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1).replace('.', ',')} MB`;
}

export function sanitizeFileName(name: string, ext: MediaExtension | string): string {
  const cleanExt = ext.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'bin';
  const base = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ._-]/g, ' ')
    .replace(/\.{2,}/g, '.')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\s-]+|[.\s-]+$/g, '')
    .slice(0, 72);
  const safeBase = base || 'lagdownloader-media';
  return `${safeBase}.${cleanExt}`;
}

export function pickRecommendedFormat(
  formats: MediaFormatOption[],
  settings: AppSettings,
  preferredKind?: MediaKind
): MediaFormatOption | undefined {
  if (formats.length === 0) return undefined;

  const targetKind = preferredKind;
  const pool = targetKind ? formats.filter((f) => f.kind === targetKind) : formats;
  const candidates = pool.length > 0 ? pool : formats;

  if (targetKind === 'audio' || candidates.every((f) => f.kind === 'audio')) {
    const exactAudio = candidates.find((f) => f.ext === settings.defaultAudioFormat);
    return exactAudio ?? candidates[0];
  }

  const exactVideo = candidates.find((f) => f.kind === 'video' && f.quality.includes(settings.defaultVideoQuality));
  if (exactVideo) return exactVideo;

  const firstVideo = candidates.find((f) => f.kind === 'video');
  return firstVideo ?? candidates[0];
}

export function filterHistoryItems(
  items: DownloadJob[],
  query: string,
  platformFilter: PlatformFilter
): DownloadJob[] {
  const q = query.trim().toLowerCase();
  return items.filter((item) => {
    if (platformFilter !== 'all' && item.platform !== platformFilter) {
      return false;
    }
    if (!q) return true;
    return (
      item.title.toLowerCase().includes(q) ||
      item.author.toLowerCase().includes(q) ||
      item.format.ext.toLowerCase().includes(q) ||
      PLATFORM_LABELS[item.platform].toLowerCase().includes(q)
    );
  });
}

export function buildDownloadEndpoint(params: {
  url: string;
  platform: Platform;
  formatId: string;
  title: string;
  author: string;
  ext: MediaExtension;
}): string {
  const search = new URLSearchParams({
    url: params.url,
    platform: params.platform,
    formatId: params.formatId,
    title: params.title,
    author: params.author,
    ext: params.ext,
  });
  return `/api/download?${search.toString()}`;
}
