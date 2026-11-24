import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  Download,
  FolderOpen,
  ListChecks,
  Moon,
  Settings,
  Sun,
  WifiOff,
  X,
} from 'lucide-react';
import { DownloaderView } from './components/DownloaderView';
import { LibraryView } from './components/LibraryView';
import { QueueView } from './components/QueueView';
import { SettingsView } from './components/SettingsView';
import { useOnlineStatus, usePWAInstall } from './hooks/usePWAInstall';
import {
  DEFAULT_SETTINGS,
  buildDownloadEndpoint,
  sanitizeFileName,
  validateMediaUrl,
  type AppSettings,
  type DownloadJob,
  type MediaFormatOption,
  type MediaInfo,
  type PlatformFilter,
} from './lib/mediaUtils';

type AppTab = 'download' | 'queue' | 'library' | 'settings';

const SETTINGS_STORAGE_KEY = 'lagdownloader_settings_v1';
const HISTORY_STORAGE_KEY = 'lagdownloader_history_v1';

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function loadHistory(): DownloadJob[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function triggerBrowserSave(href: string, fileName: string) {
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('download');
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformFilter>('all');
  const [urlInput, setUrlInput] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectedMedia, setInspectedMedia] = useState<MediaInfo | null>(null);

  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [historyItems, setHistoryItems] = useState<DownloadJob[]>(() => loadHistory());
  const [queueJobs, setQueueJobs] = useState<DownloadJob[]>([]);
  const [blobUrls, setBlobUrls] = useState<Record<string, string>>({});
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  const blobUrlsRef = useRef<Record<string, string>>({});
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const isOnline = useOnlineStatus();

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage quota errors
    }

    const root = document.documentElement;
    const prefersDark =
      window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark =
      settings.theme === 'dark' || (settings.theme === 'system' && prefersDark);
    root.classList.toggle('dark', shouldBeDark);
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(historyItems.slice(0, 60)));
    } catch {
      // Ignore storage quota errors
    }
  }, [historyItems]);

  useEffect(() => {
    return () => {
      Object.values(blobUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const handleInspectUrl = useCallback(
    async (overrideUrl?: string, overridePlatform?: PlatformFilter) => {
      const targetUrl = overrideUrl !== undefined ? overrideUrl : urlInput;
      const targetPlatform = overridePlatform !== undefined ? overridePlatform : selectedPlatform;

      setValidationError(null);
      setInspectError(null);

      const check = validateMediaUrl(targetUrl, targetPlatform);
      if (!check.valid || !check.normalizedUrl) {
        setValidationError(check.error || 'Link inválido.');
        return;
      }

      setIsInspecting(true);
      setInspectedMedia(null);

      try {
        const res = await fetch('/api/inspect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: check.normalizedUrl,
            platform: targetPlatform,
          }),
        });
        const data = (await res.json()) as { media?: MediaInfo; error?: string };
        if (!res.ok || !data.media) {
          setInspectError(data.error || 'Não foi possível carregar as informações deste link.');
          return;
        }
        setInspectedMedia(data.media);
      } catch {
        setInspectError('Falha de conexão ao analisar o link. Verifique sua internet.');
      } finally {
        setIsInspecting(false);
      }
    },
    [urlInput, selectedPlatform]
  );

  const runDownloadJob = useCallback(async (job: DownloadJob) => {
    setQueueJobs((prev) => {
      const exists = prev.some((j) => j.jobId === job.jobId);
      if (exists) {
        return prev.map((j) =>
          j.jobId === job.jobId
            ? { ...j, status: 'fetching', progress: 10, errorMessage: undefined }
            : j
        );
      }
      return [{ ...job, status: 'fetching', progress: 10 }, ...prev];
    });

    try {
      const response = await fetch(job.downloadEndpoint);
      if (!response.ok) {
        let message = 'Não foi possível concluir o download.';
        try {
          const errJson = (await response.json()) as { error?: string };
          if (errJson.error) message = errJson.error;
        } catch {
          // Non-JSON error
        }
        throw new Error(message);
      }

      const contentLengthHeader = response.headers.get('content-length');
      const totalBytes = contentLengthHeader ? Number(contentLengthHeader) : 0;

      let blob: Blob;
      if (response.body) {
        const reader = response.body.getReader();
        const chunks: Uint8Array<ArrayBuffer>[] = [];
        let received = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(new Uint8Array(value));
            received += value.byteLength;
            const nextProgress =
              totalBytes > 0
                ? Math.min(96, Math.round((received / totalBytes) * 100))
                : Math.min(92, 18 + Math.round(Math.log10(received / 1024 + 1) * 26));
            setQueueJobs((prev) =>
              prev.map((j) =>
                j.jobId === job.jobId
                  ? {
                      ...j,
                      status: job.format.kind === 'audio' ? 'converting' : 'fetching',
                      progress: Math.max(j.progress, nextProgress),
                    }
                  : j
              )
            );
          }
        }
        const mimeType =
          response.headers.get('content-type') ||
          (job.format.ext === 'mp4'
            ? 'video/mp4'
            : job.format.ext === 'mp3'
              ? 'audio/mpeg'
              : 'audio/mp4');
        blob = new Blob(chunks, { type: mimeType });
      } else {
        blob = await response.blob();
      }

      const objectUrl = URL.createObjectURL(blob);
      blobUrlsRef.current[job.jobId] = objectUrl;
      setBlobUrls((prev) => ({ ...prev, [job.jobId]: objectUrl }));

      triggerBrowserSave(objectUrl, job.fileName);

      const completedJob: DownloadJob = {
        ...job,
        status: 'completed',
        progress: 100,
        completedAt: Date.now(),
      };

      setQueueJobs((prev) => prev.map((j) => (j.jobId === job.jobId ? completedJob : j)));
      setHistoryItems((prev) => [
        completedJob,
        ...prev.filter((item) => item.jobId !== completedJob.jobId),
      ]);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Erro inesperado durante o download.';
      setQueueJobs((prev) =>
        prev.map((j) =>
          j.jobId === job.jobId ? { ...j, status: 'error', errorMessage } : j
        )
      );
    }
  }, []);

  const handleStartDownload = useCallback(
    (media: MediaInfo, format: MediaFormatOption) => {
      const jobId = `${media.platform}-${media.id}-${format.id}-${Date.now()}`;
      const fileName = sanitizeFileName(media.title, format.ext);
      const downloadEndpoint = buildDownloadEndpoint({
        url: media.canonicalUrl,
        platform: media.platform,
        formatId: format.id,
        title: media.title,
        author: media.author,
        ext: format.ext,
      });

      const job: DownloadJob = {
        jobId,
        mediaId: media.id,
        url: media.canonicalUrl,
        platform: media.platform,
        title: media.title,
        author: media.author,
        thumbnailUrl: media.thumbnailUrl,
        format,
        status: 'queued',
        progress: 5,
        createdAt: Date.now(),
        downloadEndpoint,
        fileName,
      };

      void runDownloadJob(job);
    },
    [runDownloadJob]
  );

  const handleTriggerSave = useCallback(
    (job: DownloadJob) => {
      const existingUrl = blobUrlsRef.current[job.jobId];
      if (existingUrl) {
        triggerBrowserSave(existingUrl, job.fileName);
        return;
      }
      void runDownloadJob({
        ...job,
        jobId: `${job.mediaId}-${Date.now()}`,
        createdAt: Date.now(),
      });
    },
    [runDownloadJob]
  );

  const handleRemoveJob = useCallback((jobId: string) => {
    setQueueJobs((prev) => prev.filter((j) => j.jobId !== jobId));
  }, []);

  const handleDeleteHistoryItem = useCallback((jobId: string) => {
    setHistoryItems((prev) => prev.filter((item) => item.jobId !== jobId));
  }, []);

  const handleClearHistory = useCallback(() => {
    setHistoryItems([]);
  }, []);

  const toggleQuickTheme = () => {
    const isDarkNow = document.documentElement.classList.contains('dark');
    setSettings((prev) => ({ ...prev, theme: isDarkNow ? 'light' : 'dark' }));
  };

  const activeQueueCount = queueJobs.filter(
    (j) => j.status === 'queued' || j.status === 'fetching' || j.status === 'converting'
  ).length;

  const navItems: { id: AppTab; label: string; Icon: React.ElementType; count?: number }[] = [
    { id: 'download', label: 'Baixar', Icon: ArrowDownToLine },
    { id: 'queue', label: 'Fila', Icon: ListChecks, count: activeQueueCount || undefined },
    { id: 'library', label: 'Salvos', Icon: FolderOpen, count: historyItems.length || undefined },
    { id: 'settings', label: 'Ajustes', Icon: Settings },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100">
      <header className="sticky top-0 z-30 h-14 bg-white/90 dark:bg-[#0B0F17]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-6xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => setActiveTab('download')}
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded-lg"
          >
            <img
              src="/src/assets/images/lagdownloader_icon_1795533551400.jpg"
              alt="Ícone LagDownloader"
              className="w-7 h-7 rounded-lg object-cover shrink-0"
            />
            <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0">
              LagDownloader
            </span>
          </button>

          <nav aria-label="Navegação principal" className="hidden md:flex items-center gap-6">
            {navItems.map(({ id, label, count }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`min-h-[44px] px-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                    active
                      ? 'border-rose-600 text-slate-900 dark:text-white'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {label}
                  {typeof count === 'number' && count > 0 ? ` (${count})` : ''}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center shrink-0">
            {!isInstalled && isInstallable ? (
              <button
                type="button"
                onClick={() => void install()}
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Instalar</span>
              </button>
            ) : !isInstalled && isIOS ? (
              <button
                type="button"
                onClick={() => setShowIOSGuide(true)}
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                Instalar app
              </button>
            ) : (
              <button
                type="button"
                onClick={toggleQuickTheme}
                aria-label="Alternar tema claro e escuro"
                className="min-h-[44px] min-w-[44px] rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors shrink-0"
              >
                <Sun className="w-4 h-4 hidden dark:block" />
                <Moon className="w-4 h-4 block dark:hidden" />
              </button>
            )}
          </div>
        </div>
      </header>

      {!isOnline && (
        <div
          role="status"
          className="bg-amber-500 text-white text-xs font-medium px-4 py-2 text-center flex items-center justify-center gap-2"
        >
          <WifiOff className="w-3.5 h-3.5" />
          <span>Sem conexão com a internet. Novos downloads exigem rede ativa.</span>
        </div>
      )}

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-5 pb-24 md:pb-10">
        {activeTab === 'download' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7">
              <DownloaderView
                selectedPlatform={selectedPlatform}
                onSelectPlatform={(p) => {
                  setSelectedPlatform(p);
                  setValidationError(null);
                }}
                urlInput={urlInput}
                onChangeUrlInput={(val) => {
                  setUrlInput(val);
                  if (validationError) setValidationError(null);
                  if (inspectError) setInspectError(null);
                }}
                validationError={validationError}
                inspectError={inspectError}
                isInspecting={isInspecting}
                inspectedMedia={inspectedMedia}
                settings={settings}
                onInspectUrl={handleInspectUrl}
                onStartDownload={handleStartDownload}
                onClearMedia={() => {
                  setInspectedMedia(null);
                  setValidationError(null);
                  setInspectError(null);
                }}
              />
            </div>

            <aside className="lg:col-span-5 space-y-4">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Downloads recentes
                </h2>
                <button
                  type="button"
                  onClick={() => setActiveTab(queueJobs.length > 0 ? 'queue' : 'library')}
                  className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline whitespace-nowrap"
                >
                  {queueJobs.length > 0 ? 'Ver fila completa' : 'Ver salvos'}
                </button>
              </div>

              <QueueView
                jobs={queueJobs.length > 0 ? queueJobs.slice(0, 4) : historyItems.slice(0, 3)}
                onRetryJob={runDownloadJob}
                onRemoveJob={
                  queueJobs.length > 0 ? handleRemoveJob : handleDeleteHistoryItem
                }
                onTriggerSave={handleTriggerSave}
                onGoToDownloader={() => setActiveTab('download')}
                compact
              />
            </aside>
          </div>
        )}

        {activeTab === 'queue' && (
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                Fila de downloads
              </h1>
              {queueJobs.some((j) => j.status === 'completed') && (
                <button
                  type="button"
                  onClick={() =>
                    setQueueJobs((prev) => prev.filter((j) => j.status !== 'completed'))
                  }
                  className="min-h-[40px] px-3 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                >
                  Limpar concluídos
                </button>
              )}
            </div>
            <QueueView
              jobs={queueJobs}
              onRetryJob={runDownloadJob}
              onRemoveJob={handleRemoveJob}
              onTriggerSave={handleTriggerSave}
              onGoToDownloader={() => setActiveTab('download')}
            />
          </div>
        )}

        {activeTab === 'library' && (
          <div className="max-w-3xl mx-auto space-y-4">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Downloads salvos
            </h1>
            <LibraryView
              items={historyItems}
              blobUrls={blobUrls}
              onRedownload={handleTriggerSave}
              onDeleteItem={handleDeleteHistoryItem}
              onGoToDownloader={() => setActiveTab('download')}
            />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-3xl mx-auto space-y-4">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Ajustes do aplicativo
            </h1>
            <SettingsView
              settings={settings}
              historyCount={historyItems.length}
              isInstallable={isInstallable}
              isInstalled={isInstalled}
              isIOS={isIOS}
              onUpdateSettings={setSettings}
              onClearHistory={handleClearHistory}
              onTriggerInstall={() => void install()}
            />
          </div>
        )}
      </main>

      <nav
        aria-label="Navegação inferior"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0B0F17]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-safe"
      >
        <div className="grid grid-cols-4 h-16 items-center">
          {navItems.map(({ id, label, Icon, count }) => {
            const active = activeTab === id;
            const accessibleLabel =
              typeof count === 'number' && count > 0 ? `${label} (${count})` : label;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                aria-label={accessibleLabel}
                aria-current={active ? 'page' : undefined}
                className={`h-full min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors relative ${
                  active
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <div className="relative" aria-hidden="true">
                  <Icon className="w-5 h-5" strokeWidth={active ? 2.4 : 1.9} />
                  {typeof count === 'number' && count > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 text-[10px] font-mono-tabular font-bold leading-none text-rose-600 dark:text-rose-400">
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-medium tracking-tight">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {showIOSGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Instalar no iPhone ou iPad"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#131A26] border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Instalar no iPhone / iPad
              </h2>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                aria-label="Fechar instruções de instalação"
                className="min-h-[44px] min-w-[44px] rounded-xl text-slate-400 hover:text-slate-700 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              1. Toque no botão <strong>Compartilhar</strong> na barra do Safari.
              <br />
              2. Role para baixo e toque em <strong>Adicionar à Tela de Início</strong>.
            </p>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="w-full min-h-[44px] rounded-xl bg-slate-900 dark:bg-rose-600 text-white text-sm font-medium"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
