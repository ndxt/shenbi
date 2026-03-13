import React, { useState, useRef, useEffect } from 'react';
import {
  Palette,
  Check,
  PanelLeft,
  PanelBottom,
  PanelRight,
  Command,
  Search,
  Sparkles,
  Maximize,
  Minimize,
  Languages,
} from 'lucide-react';
import {
  type SupportedLocale,
  useTranslation,
} from '@shenbi/i18n';
import { ThemeMode } from './AppShell';

interface TitleBarProps {
  theme: ThemeMode;
  onToggleTheme: (theme: ThemeMode) => void;
  locale: SupportedLocale;
  onChangeLocale: (locale: SupportedLocale) => void;
  showSidebar: boolean;
  onToggleSidebar: () => void;
  showInspector: boolean;
  onToggleInspector: () => void;
  showConsole: boolean;
  onToggleConsole: () => void;
  hasAssistantPanel?: boolean;
  showAssistantPanel: boolean;
  onToggleAssistantPanel: () => void;
  isMaximized: boolean;
  onToggleMaximize: () => void;
  onOpenCommandPalette?: () => void;
}

export function TitleBar({ 
  theme, 
  onToggleTheme,
  locale,
  onChangeLocale,
  showSidebar,
  onToggleSidebar,
  showInspector,
  onToggleInspector,
  showConsole,
  onToggleConsole,
  hasAssistantPanel = false,
  showAssistantPanel,
  onToggleAssistantPanel,
  isMaximized,
  onToggleMaximize,
  onOpenCommandPalette,
}: TitleBarProps) {
  const { t } = useTranslation('editorUi');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const languageDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (languageDropdownRef.current && !languageDropdownRef.current.contains(event.target as Node)) {
        setIsLanguageDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);

  const themes: { id: ThemeMode; name: string }[] = [
    { id: 'dark', name: t('titleBar.themeOption.dark') },
    { id: 'light', name: t('titleBar.themeOption.light') },
    { id: 'cursor', name: t('titleBar.themeOption.cursor') },
    { id: 'webstorm-dark', name: t('titleBar.themeOption.webstormDark') },
  ];
  const locales: { id: SupportedLocale; name: string }[] = [
    { id: 'zh-CN', name: '简体中文' },
    { id: 'en-US', name: 'English' },
  ];
  return (
    <div className="h-10 bg-bg-activity-bar border-b border-border-ide flex items-center justify-between px-4 shrink-0 select-none">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center">
          <Command size={14} className="text-white" />
        </div>
        <span className="text-[13px] font-bold tracking-tight text-text-primary">Shenbi IDE</span>
        <span className="px-1.5 py-0.5 rounded border border-border-ide text-[10px] text-text-secondary">
          Editor UI Package
        </span>
      </div>
      
      <div className="flex-1 text-center text-[11px] text-text-secondary font-medium">
        Main Preview Console
      </div>

      <div className="flex items-center gap-2 relative">
        <div className="flex items-center gap-1 bg-bg-panel border border-border-ide rounded p-0.5 mr-2">
          <button 
            onClick={onToggleSidebar}
            className={`p-1 rounded transition-colors ${showSidebar ? 'bg-bg-activity-bar text-blue-500' : 'text-text-secondary hover:text-text-primary hover:bg-bg-activity-bar'}`}
            title="Toggle Sidebar"
          >
            <PanelLeft size={14} />
          </button>
          <button 
            onClick={onToggleConsole}
            className={`p-1 rounded transition-colors ${showConsole ? 'bg-bg-activity-bar text-blue-500' : 'text-text-secondary hover:text-text-primary hover:bg-bg-activity-bar'}`}
            title="Toggle Console"
          >
            <PanelBottom size={14} />
          </button>
          <button 
            onClick={onToggleInspector}
            className={`p-1 rounded transition-colors ${showInspector ? 'bg-bg-activity-bar text-blue-500' : 'text-text-secondary hover:text-text-primary hover:bg-bg-activity-bar'}`}
            title="Toggle Inspector"
          >
            <PanelRight size={14} />
          </button>
          <button 
            onClick={onToggleAssistantPanel}
            disabled={!hasAssistantPanel}
            className={`p-1 rounded transition-colors ${showAssistantPanel ? 'bg-bg-activity-bar text-blue-500' : 'text-text-secondary hover:text-text-primary hover:bg-bg-activity-bar'} ${!hasAssistantPanel ? 'cursor-not-allowed opacity-40' : ''}`}
            title="Toggle AI Assistant"
          >
            <Sparkles size={14} />
          </button>
          <div className="w-[1px] h-3 bg-border-ide mx-0.5" />
          <button
            onClick={onOpenCommandPalette}
            className="p-1 rounded transition-colors text-text-secondary hover:text-text-primary hover:bg-bg-activity-bar"
            title="Open Command Palette (Ctrl+Shift+P)"
          >
            <Search size={14} />
          </button>
        </div>

        <button 
          onClick={onToggleMaximize}
          className={`p-1.5 rounded transition-colors ${isMaximized ? 'bg-bg-panel text-blue-500' : 'text-text-secondary hover:text-text-primary hover:bg-bg-panel'}`}
          title={isMaximized ? "Restore Layout" : "Maximize Center Area"}
        >
          {isMaximized ? <Minimize size={16} /> : <Maximize size={16} />}
        </button>

        <div className="relative" ref={languageDropdownRef}>
          <button
            onClick={() => setIsLanguageDropdownOpen(!isLanguageDropdownOpen)}
            className={`flex items-center gap-1.5 p-1.5 rounded transition-colors ${
              isLanguageDropdownOpen
                ? 'bg-bg-panel text-blue-500'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-panel'
            }`}
            title={t('titleBar.changeLanguage')}
            aria-label={t('statusBar.language')}
          >
            <Languages size={16} />
          </button>

          {isLanguageDropdownOpen && (
            <div className="absolute top-full right-0 mt-1 w-40 bg-bg-panel border border-border-ide rounded shadow-lg py-1 z-50">
              <div className="px-3 py-1.5 text-[10px] font-bold text-text-secondary uppercase tracking-wider border-b border-border-ide mb-1">
                {t('titleBar.selectLanguage')}
              </div>
              {locales.map((option) => (
                <button
                  key={option.id}
                  onClick={() => {
                    onChangeLocale(option.id);
                    setIsLanguageDropdownOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-text-primary hover:bg-bg-activity-bar transition-colors text-left"
                >
                  <div className="w-4 flex justify-center">
                    {locale === option.id ? <Check size={14} className="text-blue-500" /> : null}
                  </div>
                  {option.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-1.5 p-1.5 rounded hover:bg-bg-panel transition-colors text-text-secondary hover:text-text-primary"
            title={t('titleBar.changeTheme')}
          >
            <Palette size={16} />
          </button>

          {isDropdownOpen && (
          <div className="absolute top-full right-0 mt-1 w-48 bg-bg-panel border border-border-ide rounded shadow-lg py-1 z-50">
            <div className="px-3 py-1.5 text-[10px] font-bold text-text-secondary uppercase tracking-wider border-b border-border-ide mb-1">
              {t('titleBar.selectTheme')}
            </div>
            {themes.map(t => (
              <button
                key={t.id}
                onClick={() => {
                  onToggleTheme(t.id);
                  setIsDropdownOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-text-primary hover:bg-bg-activity-bar transition-colors text-left"
              >
                <div className="w-4 flex justify-center">
                  {theme === t.id && <Check size={14} className="text-blue-500" />}
                </div>
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
