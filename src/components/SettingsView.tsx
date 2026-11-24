import React, { useState } from 'react';
import { Download, Monitor, Moon, Smartphone, Sun, Trash2 } from 'lucide-react';
import type { AppSettings } from '../lib/mediaUtils';

interface SettingsViewProps {
  settings: AppSettings;
  historyCount: number;
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  onUpdateSettings: (next: AppSettings) => void;
  onClearHistory: () => void;
  onTriggerInstall: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  historyCount,
  isInstallable,
  isInstalled,
  isIOS,
  onUpdateSettings,
  onClearHistory,
  onTriggerInstall,
}) => {
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <div className="space-y-4">
      <section className="bg-white dark:bg-[#131A26] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Preferências de download
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Qualidade padrão selecionada automaticamente ao analisar novos links.
          </p>
        </div>

        <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <label
                htmlFor="default-video-quality"
                className="text-sm font-medium text-slate-900 dark:text-white block"
              >
                Qualidade de vídeo padrão
              </label>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Aplicada ao YouTube e Instagram
              </span>
            </div>
            <select
              id="default-video-quality"
              value={settings.defaultVideoQuality}
              onChange={(e) =>
                onUpdateSettings({
                  ...settings,
                  defaultVideoQuality: e.target.value as AppSettings['defaultVideoQuality'],
                })
              }
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              <option value="1080p">1080p Full HD</option>
              <option value="720p">720p HD</option>
              <option value="480p">480p Padrão</option>
              <option value="360p">360p Econômico</option>
            </select>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label
                htmlFor="default-audio-format"
                className="text-sm font-medium text-slate-900 dark:text-white block"
              >
                Formato de áudio padrão
              </label>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Para Spotify, YouTube MP3 e áudio do Instagram
              </span>
            </div>
            <select
              id="default-audio-format"
              value={settings.defaultAudioFormat}
              onChange={(e) =>
                onUpdateSettings({
                  ...settings,
                  defaultAudioFormat: e.target.value as AppSettings['defaultAudioFormat'],
                })
              }
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              <option value="mp3">MP3 (320 kbps)</option>
              <option value="m4a">M4A (AAC)</option>
            </select>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-sm font-medium text-slate-900 dark:text-white block">
                Aparência do aplicativo
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Escolha o tema claro, escuro ou do sistema
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl shrink-0">
              {[
                { id: 'system' as const, label: 'Auto', Icon: Monitor },
                { id: 'light' as const, label: 'Claro', Icon: Sun },
                { id: 'dark' as const, label: 'Escuro', Icon: Moon },
              ].map(({ id, label, Icon }) => {
                const active = settings.theme === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onUpdateSettings({ ...settings, theme: id })}
                    aria-pressed={active}
                    className={`min-h-[40px] px-2.5 rounded-lg text-xs font-medium flex items-center gap-1 whitespace-nowrap transition-colors ${
                      active
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white dark:bg-[#131A26] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Instalar LagDownloader no celular
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {isInstalled
                ? 'O aplicativo já está instalado neste dispositivo.'
                : 'O LagDownloader funciona como aplicativo instalável (PWA) direto pelo navegador do celular, sem precisar de loja ou arquivo APK.'}
            </p>
          </div>
        </div>

        {!isInstalled && (
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            {isInstallable && (
              <button
                type="button"
                onClick={onTriggerInstall}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Instalar aplicativo agora</span>
              </button>
            )}

            <div className="space-y-1.5">
              <p>
                <strong className="text-slate-900 dark:text-white">Android (Chrome):</strong> abra este link fora da prévia, toque no menu <span className="font-mono-tabular">⋮</span> e escolha <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>.
              </p>
              <p>
                <strong className="text-slate-900 dark:text-white">iPhone / iPad (Safari):</strong> toque em <strong>Compartilhar</strong> e selecione <strong>Adicionar à Tela de Início</strong>.
              </p>
            </div>

            {isIOS && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                No iOS, a instalação pela Tela de Início só aparece no navegador Safari.
              </p>
            )}
          </div>
        )}
      </section>

      <section className="bg-white dark:bg-[#131A26] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Histórico local ({historyCount} {historyCount === 1 ? 'item' : 'itens'})
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Remove todos os registros salvos neste navegador.
          </p>
        </div>

        {!confirmClear ? (
          <button
            type="button"
            disabled={historyCount === 0}
            onClick={() => setConfirmClear(true)}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-40 flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Limpar histórico</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setConfirmClear(false)}
              className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                onClearHistory();
                setConfirmClear(false);
              }}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium whitespace-nowrap"
            >
              Confirmar exclusão
            </button>
          </div>
        )}
      </section>
    </div>
  );
};
