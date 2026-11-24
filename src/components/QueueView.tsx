import React from 'react';
import {
  AlertCircle,
  ArrowDownToLine,
  CheckCircle2,
  Loader2,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { PLATFORM_LABELS, type DownloadJob } from '../lib/mediaUtils';
import { MediaThumbnail } from './PlatformGlyph';

interface QueueViewProps {
  jobs: DownloadJob[];
  onRetryJob: (job: DownloadJob) => void;
  onRemoveJob: (jobId: string) => void;
  onTriggerSave: (job: DownloadJob) => void;
  onGoToDownloader: () => void;
  compact?: boolean;
}

function statusText(job: DownloadJob): string {
  if (job.status === 'queued') return 'Na fila';
  if (job.status === 'fetching') return 'Baixando mídia...';
  if (job.status === 'converting') return 'Convertendo áudio...';
  if (job.status === 'completed') return 'Concluído';
  return job.errorMessage || 'Erro no download';
}

export const QueueView: React.FC<QueueViewProps> = ({
  jobs,
  onRetryJob,
  onRemoveJob,
  onTriggerSave,
  onGoToDownloader,
  compact = false,
}) => {
  if (jobs.length === 0) {
    return (
      <section className="bg-white dark:bg-[#131A26] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 text-center space-y-3">
        <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center mx-auto">
          <ArrowDownToLine className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Nenhum download na fila
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Os downloads em andamento e recém-concluídos aparecem aqui.
          </p>
        </div>
        {!compact && (
          <button
            type="button"
            onClick={onGoToDownloader}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium inline-flex items-center justify-center transition-colors"
          >
            Baixar nova mídia
          </button>
        )}
      </section>
    );
  }

  return (
    <section
      aria-label="Fila de downloads"
      className="bg-white dark:bg-[#131A26] border border-slate-200/90 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800"
    >
      {jobs.map((job) => {
        const isActive = job.status === 'queued' || job.status === 'fetching' || job.status === 'converting';
        const isDone = job.status === 'completed';
        const isError = job.status === 'error';

        return (
          <div key={job.jobId} data-testid="queue-job-item" className="p-4 sm:p-5 space-y-3">
            <div className="flex items-start gap-3.5">
              <MediaThumbnail
                src={job.thumbnailUrl}
                alt={job.title}
                platform={job.platform}
                className="w-14 h-14 rounded-xl"
              />

              <div className="flex-1 min-w-0 space-y-1">
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span>{PLATFORM_LABELS[job.platform]}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular uppercase">{job.format.ext}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular">{job.format.quality}</span>
                </div>

                <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {job.title}
                </h3>

                <div className="flex items-center gap-1.5 text-xs">
                  {isActive && <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600 dark:text-rose-400 shrink-0" />}
                  {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                  {isError && <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />}
                  <span
                    className={
                      isError
                        ? 'text-rose-600 dark:text-rose-400'
                        : isDone
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-slate-600 dark:text-slate-300'
                    }
                  >
                    {statusText(job)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {isDone && (
                  <button
                    type="button"
                    onClick={() => onTriggerSave(job)}
                    aria-label={`Salvar arquivo '${job.title}'`}
                    className="min-h-[44px] min-w-[44px] px-3 rounded-xl text-xs font-medium bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    <ArrowDownToLine className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Salvar</span>
                  </button>
                )}

                {isError && (
                  <button
                    type="button"
                    onClick={() => onRetryJob(job)}
                    aria-label={`Tentar novamente '${job.title}'`}
                    className="min-h-[44px] min-w-[44px] px-3 rounded-xl text-xs font-medium bg-rose-600 text-white hover:bg-rose-700 flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Tentar</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onRemoveJob(job.jobId)}
                  aria-label={`Remover '${job.title}' da fila`}
                  className="min-h-[44px] min-w-[44px] rounded-xl text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {isActive && (
              <div className="space-y-1">
                <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-rose-600 transition-transform duration-200 origin-left"
                    style={{ width: `${Math.max(8, Math.min(100, job.progress))}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] font-mono-tabular text-slate-500 dark:text-slate-400">
                  <span>{job.fileName}</span>
                  <span>{Math.round(job.progress)}%</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
};
