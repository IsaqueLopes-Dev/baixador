import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SETTINGS,
  detectPlatform,
  extractInstagramShortcode,
  extractSpotifyInfo,
  extractYouTubeId,
  filterHistoryItems,
  formatDuration,
  formatFileSize,
  isAllowedRemoteMediaHost,
  pickRecommendedFormat,
  sanitizeFileName,
  validateMediaUrl,
  type DownloadJob,
  type MediaFormatOption,
} from './mediaUtils';

test('detectPlatform identifies YouTube, Spotify, and Instagram links accurately', () => {
  assert.equal(detectPlatform('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'youtube');
  assert.equal(detectPlatform('https://youtu.be/dQw4w9WgXcQ'), 'youtube');
  assert.equal(detectPlatform('https://youtube.com/shorts/abcDEF12345'), 'youtube');
  assert.equal(detectPlatform('https://music.youtube.com/watch?v=dQw4w9WgXcQ'), 'youtube');
  assert.equal(detectPlatform('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT'), 'spotify');
  assert.equal(detectPlatform('https://open.spotify.com/intl-pt/track/4cOdK2wGLETKBW3PvgPWqT'), 'spotify');
  assert.equal(detectPlatform('https://www.instagram.com/reel/Cxample123/'), 'instagram');
  assert.equal(detectPlatform('https://instagram.com/p/Cxample123/'), 'instagram');

  assert.equal(detectPlatform('javascript:alert(1)'), null);
  assert.equal(detectPlatform('http://localhost:3000/test'), null);
  assert.equal(detectPlatform('https://example.com/video'), null);
});

test('validateMediaUrl rejects empty, malformed, and mismatched platform URLs', () => {
  assert.equal(validateMediaUrl('').valid, false);
  assert.equal(validateMediaUrl('   ').valid, false);
  assert.equal(validateMediaUrl('not a valid url').valid, false);
  assert.equal(validateMediaUrl('https://google.com').valid, false);

  const yt = validateMediaUrl('https://youtu.be/dQw4w9WgXcQ', 'all');
  assert.equal(yt.valid, true);
  assert.equal(yt.platform, 'youtube');

  const mismatch = validateMediaUrl('https://youtu.be/dQw4w9WgXcQ', 'spotify');
  assert.equal(mismatch.valid, false);
  assert.ok(mismatch.error?.includes('YouTube'));

  const sp = validateMediaUrl('open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT', 'spotify');
  assert.equal(sp.valid, true);
  assert.equal(sp.platform, 'spotify');
});

test('extractYouTubeId, extractSpotifyInfo, and extractInstagramShortcode parse IDs', () => {
  assert.equal(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10'), 'dQw4w9WgXcQ');
  assert.equal(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(extractYouTubeId('https://www.youtube.com/shorts/abcdefghijk'), 'abcdefghijk');
  assert.equal(extractYouTubeId('https://www.youtube.com/watch?v=bad'), null);

  assert.deepEqual(extractSpotifyInfo('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT'), {
    type: 'track',
    id: '4cOdK2wGLETKBW3PvgPWqT',
  });
  assert.deepEqual(extractInstagramShortcode('https://www.instagram.com/reel/C12345abc/'), {
    kind: 'reel',
    shortcode: 'C12345abc',
  });
});

test('formatDuration, formatFileSize, and sanitizeFileName format cleanly', () => {
  assert.equal(formatDuration(213), '3:33');
  assert.equal(formatDuration(3665), '1:01:05');
  assert.equal(formatDuration(undefined), '—');

  assert.equal(formatFileSize(512 * 1024), '512 KB');
  assert.equal(formatFileSize(15 * 1024 * 1024), '15,0 MB');

  assert.equal(sanitizeFileName('../../evil:name*?.mp4', 'mp4'), 'evil name .mp4.mp4');
  assert.equal(sanitizeFileName('Música Top — Ao Vivo', 'mp3'), 'Musica Top Ao Vivo.mp3');
});

test('isAllowedRemoteMediaHost blocks SSRF targets and permits trusted media CDNs', () => {
  assert.equal(isAllowedRemoteMediaHost('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg'), true);
  assert.equal(isAllowedRemoteMediaHost('https://rr1---sn-abc.googlevideo.com/videoplayback'), true);
  assert.equal(isAllowedRemoteMediaHost('https://scontent.cdninstagram.com/v/video.mp4'), true);
  assert.equal(isAllowedRemoteMediaHost('https://i.scdn.co/image/ab67616d0000b273'), true);

  assert.equal(isAllowedRemoteMediaHost('http://127.0.0.1:8080/secret'), false);
  assert.equal(isAllowedRemoteMediaHost('http://localhost:3000/api/health'), false);
  assert.equal(isAllowedRemoteMediaHost('http://169.254.169.254/latest/meta-data/'), false);
  assert.equal(isAllowedRemoteMediaHost('http://192.168.1.1/admin'), false);
  assert.equal(isAllowedRemoteMediaHost('https://evil.example.com/payload.mp4'), false);
});

test('pickRecommendedFormat and filterHistoryItems honor settings and search queries', () => {
  const formats: MediaFormatOption[] = [
    { id: 'v1080', label: 'Vídeo Full HD', kind: 'video', ext: 'mp4', quality: '1080p', sizeLabel: '42 MB' },
    { id: 'v720', label: 'Vídeo HD', kind: 'video', ext: 'mp4', quality: '720p', sizeLabel: '24 MB' },
    { id: 'a320', label: 'Áudio MP3', kind: 'audio', ext: 'mp3', quality: '320 kbps', sizeLabel: '6 MB' },
  ];

  assert.equal(pickRecommendedFormat(formats, DEFAULT_SETTINGS, 'video')?.id, 'v720');
  assert.equal(pickRecommendedFormat(formats, DEFAULT_SETTINGS, 'audio')?.id, 'a320');

  const jobs: DownloadJob[] = [
    {
      jobId: '1',
      mediaId: 'yt1',
      url: 'https://youtu.be/dQw4w9WgXcQ',
      platform: 'youtube',
      title: 'Lo-Fi Beats Mix',
      author: 'Studio Canal',
      thumbnailUrl: '',
      format: formats[1],
      status: 'completed',
      progress: 100,
      createdAt: 1000,
      downloadEndpoint: '/api/download?x=1',
      fileName: 'Lo-Fi Beats Mix.mp4',
    },
    {
      jobId: '2',
      mediaId: 'sp1',
      url: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
      platform: 'spotify',
      title: 'Midnight Groove',
      author: 'DJ Luna',
      thumbnailUrl: '',
      format: formats[2],
      status: 'completed',
      progress: 100,
      createdAt: 2000,
      downloadEndpoint: '/api/download?x=2',
      fileName: 'Midnight Groove.mp3',
    },
  ];

  assert.equal(filterHistoryItems(jobs, '', 'spotify').length, 1);
  assert.equal(filterHistoryItems(jobs, 'luna', 'all').length, 1);
  assert.equal(filterHistoryItems(jobs, 'mp3', 'all').length, 1);
});
