import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { Quality, Ytdl } from '@distube/ytdl-core';
import ytSearch from 'yt-search';
import {
  buildDownloadEndpoint,
  extractInstagramShortcode,
  extractSpotifyInfo,
  extractYouTubeId,
  formatDuration,
  formatFileSize,
  isAllowedRemoteMediaHost,
  sanitizeFileName,
  validateMediaUrl,
  type MediaFormatOption,
  type MediaInfo,
  type Platform,
} from './src/lib/mediaUtils.ts';

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const ytdl = new Ytdl({ timeoutMs: 12000 });

const BROWSER_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

interface ResolvedSpotifyData {
  title: string;
  author: string;
  thumbnailUrl: string;
  durationSec?: number;
  previewUrl?: string;
}

interface ResolvedInstagramData {
  title: string;
  author: string;
  thumbnailUrl: string;
  videoUrl?: string;
  durationSec?: number;
  blockedReason?: string;
}

async function safeFetchWithAllowlist(
  url: string,
  options: { headers?: Record<string, string>; timeoutMs?: number } = {}
): Promise<globalThis.Response> {
  let currentUrl = url;
  for (let hop = 0; hop < 4; hop += 1) {
    if (!isAllowedRemoteMediaHost(currentUrl)) {
      throw new Error('Host de destino não permitido.');
    }
    const resp = await fetch(currentUrl, {
      headers: options.headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(options.timeoutMs ?? 9000),
    });
    if (resp.status >= 300 && resp.status < 400) {
      const location = resp.headers.get('location');
      if (!location) {
        throw new Error('Redirecionamento inválido.');
      }
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }
    return resp;
  }
  throw new Error('Limite de redirecionamentos excedido.');
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\\u0026/g, '&')
    .replace(/\\\//g, '/');
}

function proxyThumbUrl(rawThumb: string): string {
  if (!rawThumb || !isAllowedRemoteMediaHost(rawThumb)) {
    return '';
  }
  return `/api/thumbnail?url=${encodeURIComponent(rawThumb)}`;
}

async function inspectYouTube(url: string): Promise<MediaInfo> {
  const videoId = extractYouTubeId(url);
  if (!videoId) {
    throw new Error('Link do YouTube inválido.');
  }
  const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // Try full ytdl inspection first
  try {
    const info = await Promise.race([
      ytdl.getInfo(canonicalUrl),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Tempo limite ao consultar formatos do YouTube.')), 9000)
      ),
    ]);

    const details = info.videoDetails;
    const durationSec = Number(details.lengthSeconds) || undefined;
    const thumbnails = details.thumbnails ?? [];
    const bestThumb = thumbnails[thumbnails.length - 1]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    const seenQualities = new Set<string>();
    const videoFormats: MediaFormatOption[] = [];

    const combinedFormats = info.formats
      .filter((f) => f.hasVideo && f.hasAudio && f.container === 'mp4' && f.qualityLabel)
      .sort((a, b) => (b.height ?? 0) - (a.height ?? 0));

    for (const fmt of combinedFormats) {
      const q = fmt.qualityLabel || `${fmt.height ?? 360}p`;
      if (seenQualities.has(q)) continue;
      seenQualities.add(q);
      const sizeBytes = fmt.contentLength ? Number(fmt.contentLength) : undefined;
      videoFormats.push({
        id: `yt-mp4-${fmt.itag}`,
        label: `Vídeo MP4 (${q})`,
        kind: 'video',
        ext: 'mp4',
        quality: q,
        sizeLabel: sizeBytes ? formatFileSize(sizeBytes) : durationSec ? formatFileSize(durationSec * 140000) : 'HD MP4',
        itag: fmt.itag,
      });
    }

    const highVideo = info.formats
      .filter((f) => f.hasVideo && !f.hasAudio && f.height && f.height >= 720)
      .sort((a, b) => (b.height ?? 0) - (a.height ?? 0));
    for (const hv of highVideo) {
      const q = hv.qualityLabel || `${hv.height}p`;
      const baseQ = `${hv.height}p`;
      if (!seenQualities.has(q) && !seenQualities.has(baseQ) && (hv.height === 1080 || hv.height === 720)) {
        seenQualities.add(baseQ);
        videoFormats.unshift({
          id: `yt-mux-${hv.height}`,
          label: `Vídeo MP4 (${baseQ})`,
          kind: 'video',
          ext: 'mp4',
          quality: baseQ,
          sizeLabel: durationSec ? formatFileSize(durationSec * (hv.height === 1080 ? 320000 : 180000)) : 'Full HD',
          itag: hv.itag,
        });
      }
    }

    if (videoFormats.length === 0) {
      videoFormats.push({
        id: 'yt-mp4-best',
        label: 'Vídeo MP4 (HD)',
        kind: 'video',
        ext: 'mp4',
        quality: '720p',
        sizeLabel: durationSec ? formatFileSize(durationSec * 160000) : 'HD MP4',
      });
    }

    const audioFormats: MediaFormatOption[] = [
      {
        id: 'yt-mp3-320',
        label: 'Áudio MP3 (Alta qualidade)',
        kind: 'audio',
        ext: 'mp3',
        quality: '320 kbps',
        sizeLabel: durationSec ? formatFileSize(durationSec * 40000) : '~4,5 MB',
      },
      {
        id: 'yt-m4a-128',
        label: 'Áudio M4A (AAC)',
        kind: 'audio',
        ext: 'm4a',
        quality: '128 kbps',
        sizeLabel: durationSec ? formatFileSize(durationSec * 16000) : '~2,0 MB',
      },
    ];

    return {
      id: videoId,
      url,
      canonicalUrl,
      platform: 'youtube',
      title: details.title || 'Vídeo do YouTube',
      author: details.author?.name || 'Canal do YouTube',
      durationSec,
      durationLabel: formatDuration(durationSec),
      thumbnailUrl: proxyThumbUrl(bestThumb),
      formats: [...videoFormats.slice(0, 4), ...audioFormats],
      streamable: true,
    };
  } catch {
    // Fallback to official YouTube oEmbed + yt-search so metadata is always real
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`;
    const resp = await safeFetchWithAllowlist(oembedUrl, { timeoutMs: 7000 });
    if (!resp.ok) {
      throw new Error('Não foi possível encontrar este vídeo do YouTube. Verifique se o link é público.');
    }
    const oembed = (await resp.json()) as { title?: string; author_name?: string; thumbnail_url?: string };

    let durationSec: number | undefined;
    try {
      const searchRes = await ytSearch({ videoId });
      if (searchRes && typeof searchRes.seconds === 'number') {
        durationSec = searchRes.seconds;
      }
    } catch {
      // Optional enrichment
    }

    const thumb = oembed.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    return {
      id: videoId,
      url,
      canonicalUrl,
      platform: 'youtube',
      title: oembed.title || 'Vídeo do YouTube',
      author: oembed.author_name || 'Canal do YouTube',
      durationSec,
      durationLabel: formatDuration(durationSec),
      thumbnailUrl: proxyThumbUrl(thumb),
      formats: [
        {
          id: 'yt-mp4-best',
          label: 'Vídeo MP4 (720p HD)',
          kind: 'video',
          ext: 'mp4',
          quality: '720p',
          sizeLabel: durationSec ? formatFileSize(durationSec * 160000) : 'HD MP4',
        },
        {
          id: 'yt-mp4-360',
          label: 'Vídeo MP4 (360p Compacto)',
          kind: 'video',
          ext: 'mp4',
          quality: '360p',
          sizeLabel: durationSec ? formatFileSize(durationSec * 70000) : 'MP4',
        },
        {
          id: 'yt-mp3-320',
          label: 'Áudio MP3 (Alta qualidade)',
          kind: 'audio',
          ext: 'mp3',
          quality: '320 kbps',
          sizeLabel: durationSec ? formatFileSize(durationSec * 40000) : '~4,5 MB',
        },
        {
          id: 'yt-m4a-128',
          label: 'Áudio M4A (AAC)',
          kind: 'audio',
          ext: 'm4a',
          quality: '128 kbps',
          sizeLabel: durationSec ? formatFileSize(durationSec * 16000) : '~2,0 MB',
        },
      ],
      sourceNote: 'Metadados obtidos via YouTube. O download tentará extração direta pelo servidor.',
      streamable: true,
    };
  }
}

async function resolveSpotifyMetadata(url: string): Promise<ResolvedSpotifyData> {
  const spInfo = extractSpotifyInfo(url);
  const canonicalUrl = spInfo ? `https://open.spotify.com/${spInfo.type}/${spInfo.id}` : url;

  const oembedResp = await safeFetchWithAllowlist(
    `https://open.spotify.com/oembed?url=${encodeURIComponent(canonicalUrl)}`,
    { headers: { 'User-Agent': BROWSER_UA }, timeoutMs: 8000 }
  );

  if (!oembedResp.ok) {
    throw new Error('Não foi possível ler este link do Spotify. Verifique se é uma faixa ou álbum público.');
  }

  const oembed = (await oembedResp.json()) as {
    title?: string;
    thumbnail_url?: string;
    author_name?: string;
  };

  let title = oembed.title || 'Faixa do Spotify';
  let author = oembed.author_name || 'Artista no Spotify';
  let thumbnailUrl = oembed.thumbnail_url || '';
  let durationSec: number | undefined;
  let previewUrl: string | undefined;

  if (spInfo) {
    try {
      const embedResp = await safeFetchWithAllowlist(
        `https://open.spotify.com/embed/${spInfo.type}/${spInfo.id}`,
        { headers: { 'User-Agent': BROWSER_UA }, timeoutMs: 8000 }
      );
      if (embedResp.ok) {
        const html = await embedResp.text();
        const nextDataMatch = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
        if (nextDataMatch) {
          const parsed = JSON.parse(nextDataMatch[1]);
          const entity = parsed?.props?.pageProps?.state?.data?.entity;
          if (entity) {
            if (entity.name) title = String(entity.name);
            if (Array.isArray(entity.artists) && entity.artists.length > 0) {
              author = entity.artists.map((a: { name?: string }) => a.name).filter(Boolean).join(', ');
            } else if (entity.subtitle) {
              author = String(entity.subtitle);
            }
            if (typeof entity.duration === 'number') {
              durationSec = Math.round(entity.duration / 1000);
            }
            if (entity.audioPreview?.url && isAllowedRemoteMediaHost(entity.audioPreview.url)) {
              previewUrl = String(entity.audioPreview.url);
            }
            const cover = entity.visualIdentity?.image?.[0]?.url;
            if (cover && isAllowedRemoteMediaHost(cover)) {
              thumbnailUrl = String(cover);
            }
          }
        }
      }
    } catch {
      // Keep oEmbed data
    }
  }

  return { title, author, thumbnailUrl, durationSec, previewUrl };
}

async function inspectSpotify(url: string): Promise<MediaInfo> {
  const spInfo = extractSpotifyInfo(url);
  const canonicalUrl = spInfo ? `https://open.spotify.com/${spInfo.type}/${spInfo.id}` : url;
  const spData = await resolveSpotifyMetadata(canonicalUrl);

  const searchQuery = `${spData.title} ${spData.author} audio`;
  let durationSec = spData.durationSec;

  if (!durationSec) {
    try {
      const searchRes = await ytSearch(searchQuery);
      const top = searchRes.videos?.[0];
      if (top?.seconds) {
        durationSec = top.seconds;
      }
    } catch {
      // Optional duration lookup
    }
  }

  const formats: MediaFormatOption[] = [
    {
      id: 'sp-mp3-320',
      label: 'Música MP3 (320 kbps)',
      kind: 'audio',
      ext: 'mp3',
      quality: '320 kbps',
      sizeLabel: durationSec ? formatFileSize(durationSec * 40000) : '~4,8 MB',
    },
    {
      id: 'sp-m4a-256',
      label: 'Música M4A (AAC 256 kbps)',
      kind: 'audio',
      ext: 'm4a',
      quality: '256 kbps',
      sizeLabel: durationSec ? formatFileSize(durationSec * 32000) : '~3,8 MB',
    },
  ];

  if (spData.previewUrl) {
    formats.push({
      id: 'sp-preview-mp3',
      label: 'Prévia Oficial Spotify (30s MP3)',
      kind: 'audio',
      ext: 'mp3',
      quality: 'Prévia 30s',
      sizeLabel: '~480 KB',
      directUrl: spData.previewUrl,
    });
  }

  return {
    id: spInfo?.id || `sp-${Date.now()}`,
    url,
    canonicalUrl,
    platform: 'spotify',
    title: spData.title,
    author: spData.author,
    durationSec,
    durationLabel: formatDuration(durationSec),
    thumbnailUrl: proxyThumbUrl(spData.thumbnailUrl),
    formats,
    matchedQuery: searchQuery,
    sourceNote: 'Faixa identificada no Spotify e pareada em áudio de alta qualidade.',
    streamable: true,
  };
}

async function resolveInstagramMetadata(url: string): Promise<ResolvedInstagramData> {
  const igInfo = extractInstagramShortcode(url);
  const canonicalUrl = igInfo
    ? `https://www.instagram.com/${igInfo.kind}/${igInfo.shortcode}/`
    : url;

  const candidates = igInfo
    ? [
        `https://www.instagram.com/${igInfo.kind}/${igInfo.shortcode}/embed/captioned/`,
        canonicalUrl,
      ]
    : [canonicalUrl];

  for (const target of candidates) {
    try {
      const resp = await safeFetchWithAllowlist(target, {
        headers: {
          'User-Agent': BROWSER_UA,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        },
        timeoutMs: 8000,
      });

      if (!resp.ok) continue;
      const html = await resp.text();

      const videoMatch =
        /<meta[^>]+property=["']og:video["'][^>]+content=["']([^"']+)["']/i.exec(html) ||
        /"video_url"\s*:\s*"([^"]+)"/.exec(html);
      const imageMatch =
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i.exec(html) ||
        /class=["']EmbeddedMediaImage["'][^>]+src=["']([^"']+)["']/i.exec(html);
      const titleMatch =
        /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i.exec(html);
      const userMatch = /class=["']UsernameText["'][^>]*>([^<]+)</i.exec(html);

      const rawVideo = videoMatch ? decodeHtmlEntities(videoMatch[1]) : undefined;
      const rawThumb = imageMatch ? decodeHtmlEntities(imageMatch[1]) : '';
      const rawTitle = titleMatch ? decodeHtmlEntities(titleMatch[1]) : '';
      const author = userMatch ? decodeHtmlEntities(userMatch[1]).trim() : 'Perfil do Instagram';

      if (rawVideo || rawThumb || rawTitle) {
        return {
          title: rawTitle || `Publicação Instagram (${igInfo?.shortcode ?? 'mídia'})`,
          author,
          thumbnailUrl: rawThumb,
          videoUrl: rawVideo && isAllowedRemoteMediaHost(rawVideo) ? rawVideo : undefined,
        };
      }
    } catch {
      // Try next candidate
    }
  }

  return {
    title: `Mídia do Instagram (${igInfo?.shortcode ?? 'Reels'})`,
    author: 'Instagram',
    thumbnailUrl: '',
    blockedReason:
      'O Instagram limitou o acesso automático para este link (conteúdo privado ou bloqueio de região/IP). Tente outro Reels público.',
  };
}

async function inspectInstagram(url: string): Promise<MediaInfo> {
  const igInfo = extractInstagramShortcode(url);
  const canonicalUrl = igInfo
    ? `https://www.instagram.com/${igInfo.kind}/${igInfo.shortcode}/`
    : url;

  const igData = await resolveInstagramMetadata(canonicalUrl);
  if (igData.blockedReason && !igData.videoUrl) {
    throw new Error(igData.blockedReason);
  }

  const formats: MediaFormatOption[] = [
    {
      id: 'ig-mp4-hd',
      label: 'Vídeo MP4 (Original HD)',
      kind: 'video',
      ext: 'mp4',
      quality: 'HD MP4',
      sizeLabel: 'Vídeo original',
      directUrl: igData.videoUrl,
    },
    {
      id: 'ig-mp3-320',
      label: 'Extrair Áudio MP3',
      kind: 'audio',
      ext: 'mp3',
      quality: '320 kbps',
      sizeLabel: 'Áudio extraído',
      directUrl: igData.videoUrl,
    },
    {
      id: 'ig-m4a-128',
      label: 'Extrair Áudio M4A',
      kind: 'audio',
      ext: 'm4a',
      quality: '128 kbps',
      sizeLabel: 'Áudio AAC',
      directUrl: igData.videoUrl,
    },
  ];

  return {
    id: igInfo?.shortcode || `ig-${Date.now()}`,
    url,
    canonicalUrl,
    platform: 'instagram',
    title: igData.title,
    author: igData.author,
    durationSec: igData.durationSec,
    durationLabel: formatDuration(igData.durationSec),
    thumbnailUrl: proxyThumbUrl(igData.thumbnailUrl),
    formats,
    streamable: Boolean(igData.videoUrl),
  };
}

function pipeWithFfmpeg(
  inputStream: NodeJS.ReadableStream,
  res: Response,
  ext: 'mp3' | 'm4a',
  fileName: string
): void {
  const isMp3 = ext === 'mp3';
  const args = isMp3
    ? ['-loglevel', 'error', '-i', 'pipe:0', '-vn', '-acodec', 'libmp3lame', '-b:a', '320k', '-f', 'mp3', 'pipe:1']
    : [
        '-loglevel',
        'error',
        '-i',
        'pipe:0',
        '-vn',
        '-c:a',
        'aac',
        '-b:a',
        '256k',
        '-movflags',
        'frag_keyframe+empty_moov',
        '-f',
        'ipod',
        'pipe:1',
      ];

  res.setHeader('Content-Type', isMp3 ? 'audio/mpeg' : 'audio/mp4');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

  const ff = spawn('ffmpeg', args, { shell: false });

  inputStream.on('error', () => {
    ff.kill('SIGKILL');
    if (!res.headersSent) {
      res.status(502).json({ error: 'Falha ao receber o fluxo de mídia.' });
    } else {
      res.end();
    }
  });

  ff.on('error', () => {
    if (!res.headersSent) {
      res.status(500).json({ error: 'Erro ao converter áudio.' });
    } else {
      res.end();
    }
  });

  res.on('close', () => {
    ff.kill('SIGKILL');
  });

  inputStream.pipe(ff.stdin);
  ff.stdout.pipe(res);
}

async function streamRemoteUrlToResponse(
  remoteUrl: string,
  res: Response,
  ext: 'mp4' | 'mp3' | 'm4a',
  fileName: string
): Promise<void> {
  const upstream = await safeFetchWithAllowlist(remoteUrl, {
    headers: { 'User-Agent': BROWSER_UA },
    timeoutMs: 20000,
  });

  if (!upstream.ok || !upstream.body) {
    throw new Error('Não foi possível baixar o arquivo da origem.');
  }

  const { Readable } = await import('node:stream');
  const nodeStream = Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]);

  if (ext === 'mp4' || remoteUrl.includes('p.scdn.co')) {
    res.setHeader('Content-Type', ext === 'mp4' ? 'video/mp4' : 'audio/mpeg');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    const contentLen = upstream.headers.get('content-length');
    if (contentLen) {
      res.setHeader('Content-Length', contentLen);
    }
    nodeStream.pipe(res);
    return;
  }

  pipeWithFfmpeg(nodeStream, res, ext, fileName);
}

async function handleYouTubeDownload(
  videoUrl: string,
  formatId: string,
  ext: 'mp4' | 'mp3' | 'm4a',
  fileName: string,
  res: Response
): Promise<void> {
  const info = await ytdl.getInfo(videoUrl);

  if (ext === 'mp3' || ext === 'm4a') {
    const audioStream = ytdl.download(info, {
      filter: { hasAudio: true, hasVideo: false },
      quality: Quality.HighestAudio,
    });
    pipeWithFfmpeg(audioStream, res, ext, fileName);
    return;
  }

  let selectedFormat = info.formats.find((f) => `yt-mp4-${f.itag}` === formatId);
  if (!selectedFormat || !selectedFormat.hasAudio) {
    selectedFormat = info.formats
      .filter((f) => f.hasVideo && f.hasAudio && f.container === 'mp4')
      .sort((a, b) => (b.height ?? 0) - (a.height ?? 0))[0];
  }

  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

  const videoStream = selectedFormat
    ? ytdl.download(info, { format: selectedFormat })
    : ytdl.download(info, {
        filter: { hasAudio: true, hasVideo: true },
        quality: Quality.Highest,
      });

  videoStream.on('error', () => {
    if (!res.headersSent) {
      res.status(502).json({ error: 'O YouTube bloqueou ou interrompeu o download deste vídeo.' });
    } else {
      res.end();
    }
  });

  videoStream.pipe(res);
}

async function createServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'LagDownloader' });
  });

  app.get('/api/thumbnail', async (req: Request, res: Response) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
    if (!isAllowedRemoteMediaHost(rawUrl)) {
      res.status(400).json({ error: 'URL de miniatura inválida.' });
      return;
    }

    try {
      const upstream = await safeFetchWithAllowlist(rawUrl, {
        headers: { 'User-Agent': BROWSER_UA },
        timeoutMs: 7000,
      });
      if (!upstream.ok || !upstream.body) {
        res.status(404).end();
        return;
      }
      const contentType = upstream.headers.get('content-type') || 'image/jpeg';
      if (!contentType.startsWith('image/')) {
        res.status(415).end();
        return;
      }
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      const { Readable } = await import('node:stream');
      Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]).pipe(res);
    } catch {
      res.status(502).end();
    }
  });

  app.post('/api/inspect', async (req: Request, res: Response) => {
    const rawUrl = typeof req.body?.url === 'string' ? req.body.url : '';
    const platformHint = typeof req.body?.platform === 'string' ? req.body.platform : 'all';

    const validation = validateMediaUrl(
      rawUrl,
      platformHint === 'youtube' || platformHint === 'spotify' || platformHint === 'instagram'
        ? platformHint
        : 'all'
    );

    if (!validation.valid || !validation.normalizedUrl || !validation.platform) {
      res.status(400).json({ error: validation.error || 'URL inválida.' });
      return;
    }

    try {
      let media: MediaInfo;
      if (validation.platform === 'youtube') {
        media = await inspectYouTube(validation.normalizedUrl);
      } else if (validation.platform === 'spotify') {
        media = await inspectSpotify(validation.normalizedUrl);
      } else {
        media = await inspectInstagram(validation.normalizedUrl);
      }

      // Attach ready download endpoints per format
      const formatsWithEndpoints = media.formats.map((fmt) => ({
        ...fmt,
        downloadEndpoint: buildDownloadEndpoint({
          url: media.canonicalUrl,
          platform: media.platform,
          formatId: fmt.id,
          title: media.title,
          author: media.author,
          ext: fmt.ext,
        }),
      }));

      res.json({
        media: {
          ...media,
          formats: formatsWithEndpoints,
        },
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Não foi possível analisar este link agora.';
      res.status(422).json({ error: message });
    }
  });

  app.get('/api/download', async (req: Request, res: Response) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
    const formatId = typeof req.query.formatId === 'string' ? req.query.formatId : '';
    const title = typeof req.query.title === 'string' ? req.query.title : 'LagDownloader';
    const author = typeof req.query.author === 'string' ? req.query.author : '';
    const rawExt = typeof req.query.ext === 'string' ? req.query.ext : 'mp4';

    const ext: 'mp4' | 'mp3' | 'm4a' =
      rawExt === 'mp3' || rawExt === 'm4a' ? rawExt : 'mp4';

    const validation = validateMediaUrl(rawUrl, 'all');
    if (!validation.valid || !validation.normalizedUrl || !validation.platform) {
      res.status(400).json({ error: validation.error || 'Link inválido para download.' });
      return;
    }

    const fileName = sanitizeFileName(title, ext);

    try {
      const platform: Platform = validation.platform;

      if (platform === 'youtube') {
        const videoId = extractYouTubeId(validation.normalizedUrl);
        if (!videoId) {
          res.status(400).json({ error: 'ID do YouTube inválido.' });
          return;
        }
        await handleYouTubeDownload(
          `https://www.youtube.com/watch?v=${videoId}`,
          formatId,
          ext,
          fileName,
          res
        );
        return;
      }

      if (platform === 'spotify') {
        const spData = await resolveSpotifyMetadata(validation.normalizedUrl);
        if (formatId === 'sp-preview-mp3' && spData.previewUrl) {
          await streamRemoteUrlToResponse(spData.previewUrl, res, 'mp3', fileName);
          return;
        }
        const query = `${title || spData.title} ${author || spData.author} audio`;
        const searchRes = await ytSearch(query);
        const match = searchRes.videos?.[0];
        if (!match?.url) {
          res.status(404).json({ error: 'Nenhuma fonte de áudio correspondente foi encontrada.' });
          return;
        }
        await handleYouTubeDownload(match.url, formatId, ext === 'mp4' ? 'mp3' : ext, fileName, res);
        return;
      }

      // Instagram
      const igData = await resolveInstagramMetadata(validation.normalizedUrl);
      if (!igData.videoUrl) {
        res.status(422).json({
          error: igData.blockedReason || 'Não foi possível obter o arquivo de vídeo do Instagram.',
        });
        return;
      }
      await streamRemoteUrlToResponse(igData.videoUrl, res, ext, fileName);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Falha ao processar o download da mídia.';
      if (!res.headersSent) {
        res.status(502).json({ error: message });
      } else {
        res.end();
      }
    }
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LagDownloader server running on http://0.0.0.0:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start LagDownloader server:', err);
  process.exit(1);
});
