import React, { useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  Check,
  Copy,
  FolderOpen,
  Play,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  PLATFORM_LABELS,
  filterHistoryItems,
  type DownloadJob,
  type PlatformFilter,
} from '../lib/mediaUtils';
import { MediaThumbnail } from './PlatformGlyph';

interface LibraryViewProps {
  items: DownloadJob[];
  blobUrls: Record<string, string>;
  onRedownload: (job: DownloadJob) => void;
  onDeleteItem: (jobId: string) => void;
  onGoToDownloader: () => void;
}

const FILTER_OPTIONS: { id: PlatformFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'spotify', label: 'Spotify' },
  { id: 'instagram', label: 'Instagram' },
];

export const LibraryView: React.FC<LibraryViewProps> = ({
  items,
  blobUrls,
  onRedownload,
  onDeleteItem,
  onGoToDownloader,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewJob, setPreviewJob] = useState<DownloadJob | null>(null);

  const filtered = useMemo(
    () => filterHistoryItems(items, searchQuery, platformFilter),
    [items, searchQuery, platformFilter]
  );

  const handleCopyLink = async (job: DownloadJob) => {
    try {
      await navigator.clipboard.writeText(job.url);
      setCopiedId(job.jobId);
      setTimeout(() => setCopiedId((prev) => (prev === job.jobId ? null : prev)), 2000);
    } catch {
      // Clipboard blocked in some browser contexts
    }
  };

  if (items.length === 0) {
    return (
      <section className="bg-white dark:bg-[#131A26] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-8 text-center space-y-3.5">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center mx-auto">
          <FolderOpen className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Sua biblioteca está vazia
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Quando você baixar vídeos do YouTube, músicas do Spotify ou mídias do Instagram, elas ficarão salvas aqui.
          </p>
        </div>
        <button
          type="button"
          onClick={onGoToDownloader}
          className="min-h-[44px] px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium inline-flex items-center justify-center transition-colors"
        >
          Ir para Baixar
        </button>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="bg-white dark:bg-[#131A26] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3.5">
        <div className="relative">
          <label htmlFor="library-search-input" className="sr-only">
            Buscar nos downloads salvos
          </label>
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="library-search-input"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por título, artista ou formato..."
            className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          />
        </div>

        <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
          {FILTER_OPTIONS.map((opt) => {
            const active = platformFilter === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPlatformFilter(opt.id)}
                className={`min-h-[40px] px-2 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </section>

      {filtered.length === 0 ? (
        <section className="bg-white dark:bg-[#131A26] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 text-center space-y-2">
          <p className="text-sm font-medium text-slate-900 dark:text-white">
            Nenhum item encontrado
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Tente limpar a busca ou escolher outra plataforma.
          </p>
        </section>
      ) : (
        <section
          aria-label="Downloads salvos"
          className="bg-white dark:bg-[#131A26] border border-slate-200/90 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800"
        >
          {filtered.map((job) => {
            const hasSessionMedia = Boolean(blobUrls[job.jobId]);
            const isCopied = copiedId === job.jobId;
            return (
              <div
                key={job.jobId}
                data-testid="library-item"
                className="p-4 sm:p-5 flex items-center gap-3.5"
              >
                <MediaThumbnail
                  src={job.thumbnailUrl}
                  alt={job.title}
                  platform={job.platform}
                  className="w-14 h-14 rounded-xl"
                />

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate">
                    <span>{PLATFORM_LABELS[job.platform]}</span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{job.author}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-tabular uppercase shrink-0">{job.format.ext}</span>
                  </div>

                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {job.title}
                  </h3>

                  <p className="text-[11px] font-mono-tabular text-slate-400 dark:text-slate-500">
                    {job.format.quality} · {new Date(job.completedAt ?? job.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {hasSessionMedia && (
                    <button
                      type="button"
                      onClick={() => setPreviewJob(job)}
                      aria-label={`Reproduzir '${job.title}'`}
                      className="min-h-[44px] min-w-[44px] rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center justify-center transition-colors"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onRedownload(job)}
                    aria-label={`Baixar novamente '${job.title}'`}
                    className="min-h-[44px] min-w-[44px] rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
                  >
                    <ArrowDownToLine className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyLink(job)}
                    aria-label={`Copiar link de '${job.title}'`}
                    className="min-h-[44px] min-w-[44px] rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
                  >
                    {isCopied ? (
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteItem(job.jobId)}
                    aria-label={`Excluir '${job.title}'`}
                    className="min-h-[44px] min-w-[44px] rounded-xl text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {previewJob && blobUrls[previewJob.jobId] && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Reprodutor de ${previewJob.title}`}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
        >
          <div className="w-full sm:max-w-lg bg-white dark:bg-[#131A26] rounded-t-3xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto sm:hidden" />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {PLATFORM_LABELS[previewJob.platform]} · {previewJob.author}
                </p>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white truncate">
                  {previewJob.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewJob(null)}
                aria-label="Fechar reprodutor"
                className="min-h-[44px] min-w-[44px] rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {previewJob.format.kind === 'video' ? (
              <video
                src={blobUrls[previewJob.jobId]}
                controls
                autoPlay
                playsInline
                className="w-full rounded-xl bg-black max-h-[60vh]"
              />
            ) : (
              <audio
                src={blobUrls[previewJob.jobId]}
                controls
                autoPlay
                className="w-full"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
