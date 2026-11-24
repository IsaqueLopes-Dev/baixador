import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowDownToLine,
  Check,
  ClipboardPaste,
  Film,
  Loader2,
  Music,
  Search,
  X,
} from 'lucide-react';
import {
  PLATFORM_LABELS,
  pickRecommendedFormat,
  validateMediaUrl,
  type AppSettings,
  type MediaFormatOption,
  type MediaInfo,
  type PlatformFilter,
} from '../lib/mediaUtils';
import { MediaThumbnail, PlatformGlyph } from './PlatformGlyph';

interface DownloaderViewProps {
  selectedPlatform: PlatformFilter;
  onSelectPlatform: (p: PlatformFilter) => void;
  urlInput: string;
  onChangeUrlInput: (val: string) => void;
  validationError: string | null;
  inspectError: string | null;
  isInspecting: boolean;
  inspectedMedia: MediaInfo | null;
  settings: AppSettings;
  onInspectUrl: (overrideUrl?: string, overridePlatform?: PlatformFilter) => void;
  onStartDownload: (media: MediaInfo, format: MediaFormatOption) => void;
  onClearMedia: () => void;
}

const PLATFORM_TABS: { id: PlatformFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'spotify', label: 'Spotify' },
  { id: 'instagram', label: 'Instagram' },
];

const QUICK_EXAMPLES: { platform: 'youtube' | 'spotify' | 'instagram'; label: string; url: string }[] = [
  {
    platform: 'youtube',
    label: 'Vídeo YouTube',
    url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
  },
  {
    platform: 'spotify',
    label: 'Música Spotify',
    url: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
  },
  {
    platform: 'instagram',
    label: 'Reels Instagram',
    url: 'https://www.instagram.com/reel/C5x9vA8rR1M/',
  },
];

function getPlaceholder(platform: PlatformFilter): string {
  if (platform === 'youtube') return 'https://www.youtube.com/watch?v=...';
  if (platform === 'spotify') return 'https://open.spotify.com/track/...';
  if (platform === 'instagram') return 'https://www.instagram.com/reel/...';
  return 'Cole o link do YouTube, Spotify ou Instagram';
}

export const DownloaderView: React.FC<DownloaderViewProps> = ({
  selectedPlatform,
  onSelectPlatform,
  urlInput,
  onChangeUrlInput,
  validationError,
  inspectError,
  isInspecting,
  inspectedMedia,
  settings,
  onInspectUrl,
  onStartDownload,
  onClearMedia,
}) => {
  const [selectedFormatId, setSelectedFormatId] = useState<string>('');
  const [clipboardNotice, setClipboardNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!inspectedMedia) {
      setSelectedFormatId('');
      return;
    }
    const preferredKind = inspectedMedia.platform === 'spotify' ? 'audio' : undefined;
    const recommended = pickRecommendedFormat(inspectedMedia.formats, settings, preferredKind);
    setSelectedFormatId(recommended?.id ?? inspectedMedia.formats[0]?.id ?? '');
  }, [inspectedMedia, settings]);

  const activeFormat =
    inspectedMedia?.formats.find((f) => f.id === selectedFormatId) ?? inspectedMedia?.formats[0];

  const handlePaste = async () => {
    setClipboardNotice(null);
    if (!navigator.clipboard?.readText) {
      setClipboardNotice('Permissão de área de transferência indisponível. Cole manualmente.');
      return;
    }
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setClipboardNotice('A área de transferência está vazia.');
        return;
      }
      onChangeUrlInput(text.trim());
      const check = validateMediaUrl(text.trim(), 'all');
      if (check.valid && check.platform && selectedPlatform !== 'all' && check.platform !== selectedPlatform) {
        onSelectPlatform(check.platform);
      }
    } catch {
      setClipboardNotice('Não foi possível ler a área de transferência. Cole manualmente.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onInspectUrl();
  };

  const errorToShow = validationError || inspectError;

  return (
    <div className="space-y-6">
      <section className="bg-white dark:bg-[#131A26] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-6">
        <div className="space-y-1.5 mb-5">
          <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-slate-900 dark:text-white leading-tight [text-wrap:balance]">
            Baixe vídeos e músicas direto no celular
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Suporte a YouTube (MP4 e MP3), Spotify (músicas em MP3/M4A) e Instagram (vídeo e áudio).
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Selecionar plataforma"
          className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl mb-4"
        >
          {PLATFORM_TABS.map((tab) => {
            const active = selectedPlatform === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelectPlatform(tab.id)}
                className={`min-h-[44px] px-1.5 sm:px-2.5 py-1.5 sm:py-2 rounded-lg text-[11px] sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 ${
                  active
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.id !== 'all' && <PlatformGlyph platform={tab.id} className="w-3.5 h-3.5 shrink-0" />}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-3">
          <div>
            <label htmlFor="media-url-input" className="sr-only">
              Link da mídia do YouTube, Spotify ou Instagram
            </label>
            <div className="flex items-stretch gap-2">
              <div className="relative flex-1 min-w-0">
                <input
                  id="media-url-input"
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  value={urlInput}
                  onChange={(e) => onChangeUrlInput(e.target.value)}
                  placeholder={getPlaceholder(selectedPlatform)}
                  aria-invalid={Boolean(errorToShow)}
                  aria-describedby={errorToShow ? 'url-error-message' : undefined}
                  className="w-full min-h-[48px] pl-4 pr-11 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus:border-rose-500 transition-colors"
                />
                {urlInput.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      onChangeUrlInput('');
                      onClearMedia();
                    }}
                    aria-label="Limpar link"
                    className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handlePaste}
                aria-label="Colar link da área de transferência"
                className="min-h-[48px] min-w-[48px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-colors"
              >
                <ClipboardPaste className="w-4 h-4" />
                <span className="hidden sm:inline">Colar</span>
              </button>
            </div>
          </div>

          {clipboardNotice && (
            <p className="text-xs text-slate-500 dark:text-slate-400">{clipboardNotice}</p>
          )}

          {errorToShow && (
            <div
              id="url-error-message"
              role="alert"
              className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-sm text-rose-800 dark:text-rose-200"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <span>{errorToShow}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isInspecting}
            className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-[0.99] disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap"
          >
            {isInspecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Analisando link...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Buscar mídia</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 mr-1">Testar rápido:</span>
          {QUICK_EXAMPLES.map((example) => (
            <button
              key={example.platform}
              type="button"
              onClick={() => {
                onSelectPlatform(example.platform);
                onChangeUrlInput(example.url);
                onInspectUrl(example.url, example.platform);
              }}
              className="min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/70 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <PlatformGlyph platform={example.platform} className="w-3.5 h-3.5" />
              <span>{example.label}</span>
            </button>
          ))}
        </div>
      </section>

      {isInspecting && !inspectedMedia && (
        <section
          aria-label="Carregando informações da mídia"
          className="bg-white dark:bg-[#131A26] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-start gap-4">
            <div className="w-24 h-20 rounded-xl bg-slate-200 dark:bg-slate-800 shrink-0" />
            <div className="flex-1 space-y-2.5 pt-1">
              <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-3 w-1/2 rounded bg-slate-100 dark:bg-slate-800/70" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
            <div className="h-12 rounded-xl bg-slate-100 dark:bg-slate-800/70" />
            <div className="h-12 rounded-xl bg-slate-100 dark:bg-slate-800/70" />
          </div>
        </section>
      )}

      {inspectedMedia && (
        <section
          data-testid="inspected-media-card"
          aria-label="Detalhes da mídia encontrada"
          className="bg-white dark:bg-[#131A26] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5"
        >
          <div className="flex items-start gap-4">
            <MediaThumbnail
              src={inspectedMedia.thumbnailUrl}
              alt={inspectedMedia.title}
              platform={inspectedMedia.platform}
              className="w-24 h-24 sm:w-28 sm:h-24 rounded-xl"
            />
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <PlatformGlyph platform={inspectedMedia.platform} className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>{PLATFORM_LABELS[inspectedMedia.platform]}</span>
                <span aria-hidden="true">·</span>
                <span className="truncate">{inspectedMedia.author}</span>
                {inspectedMedia.durationLabel !== '—' && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-tabular shrink-0">{inspectedMedia.durationLabel}</span>
                  </>
                )}
              </div>

              <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white leading-snug line-clamp-2">
                {inspectedMedia.title}
              </h2>

              {inspectedMedia.sourceNote && (
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {inspectedMedia.sourceNote}
                </p>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                Escolha o formato
              </span>
              {activeFormat && (
                <span className="text-xs font-mono-tabular text-slate-500 dark:text-slate-400">
                  {activeFormat.ext.toUpperCase()} · {activeFormat.sizeLabel}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {inspectedMedia.formats.map((fmt) => {
                const isSelected = activeFormat?.id === fmt.id;
                return (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => setSelectedFormatId(fmt.id)}
                    aria-pressed={isSelected}
                    className={`min-h-[52px] px-3.5 py-2.5 rounded-xl border text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-rose-600 bg-rose-50/70 dark:bg-rose-950/30 dark:border-rose-500'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-rose-600 text-white'
                            : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {fmt.kind === 'video' ? (
                          <Film className="w-4 h-4" />
                        ) : (
                          <Music className="w-4 h-4" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {fmt.label}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono-tabular">
                          {fmt.quality} · {fmt.sizeLabel}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'border-rose-600 bg-rose-600 text-white'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {activeFormat && (
            <button
              type="button"
              onClick={() => onStartDownload(inspectedMedia, activeFormat)}
              className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-rose-600 dark:hover:bg-rose-500 active:scale-[0.99] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap"
            >
              <ArrowDownToLine className="w-4 h-4" />
              <span>
                {activeFormat.kind === 'audio'
                  ? `Baixar áudio (${activeFormat.ext.toUpperCase()})`
                  : `Baixar vídeo (${activeFormat.quality})`}
              </span>
            </button>
          )}
        </section>
      )}
    </div>
  );
};
