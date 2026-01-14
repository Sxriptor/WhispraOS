/**
 * Language Library tab implementation
 * Allows users to define per-language phrase substitutions (Original -> Translated)
 * that are applied to transcribed text before translation/TTS.
 *
 * Persistence:
 * - Auto-saves to localStorage as the user types
 * - Debounced sync to persisted config via config:set (so the pipeline can use it)
 */

import { BaseSettingsTab } from '../interfaces/SettingsTab.js';

type LanguageCode = string;

interface SupportedLanguage {
  code: LanguageCode;
  name: string;
  flag: string;
}

interface LanguageLibraryEntry {
  original: string;
  translated: string;
}

type LanguageLibrary = Record<LanguageCode, LanguageLibraryEntry[]>;

export class LanguageLibraryTab extends BaseSettingsTab {
  public readonly id = 'language-library';
  public readonly title = 'Language Library';
  public readonly icon =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5V4.5A2.5 2.5 0 0 1 6.5 2z"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h6"/></svg>';
  public readonly order = 7;

  private readonly localStorageKey = 'whispra-language-library';
  private autoSaveTimer: number | null = null;
  private lastSavedSerialized: string = '';

  private supportedLanguages: SupportedLanguage[] = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Spanish', flag: '🇪🇸' },
    { code: 'fr', name: 'French', flag: '🇫🇷' },
    { code: 'de', name: 'German', flag: '🇩🇪' },
    { code: 'it', name: 'Italian', flag: '🇮🇹' },
    { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
    { code: 'ru', name: 'Russian', flag: '🇷🇺' },
    { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
    { code: 'ko', name: 'Korean', flag: '🇰🇷' },
    { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
    { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
    { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
    { code: 'th', name: 'Thai', flag: '🇹🇭' },
    { code: 'vi', name: 'Vietnamese', flag: '🇻🇳' },
    { code: 'tr', name: 'Turkish', flag: '🇹🇷' },
    { code: 'pl', name: 'Polish', flag: '🇵🇱' },
    { code: 'nl', name: 'Dutch', flag: '🇳🇱' },
    { code: 'sv', name: 'Swedish', flag: '🇸🇪' },
    { code: 'da', name: 'Danish', flag: '🇩🇰' },
    { code: 'no', name: 'Norwegian', flag: '🇳🇴' }
  ];

  private languageLibrary: LanguageLibrary = { en: [] };
  private activeLanguage: LanguageCode = 'en';

  public render(): HTMLElement {
    this.container = this.createElement('div', 'language-library-tab');
    this.container.style.cssText = `
      padding: var(--settings-spacing-lg);
    `;
    this.renderContent();
    return this.container;
  }

  public async onActivate(): Promise<void> {
    super.onActivate();
    await this.loadLibrary();
    this.ensureEnglishTab();
    this.renderContent();
  }

  public onDeactivate(): void {
    super.onDeactivate();
    this.flushAutoSave();
  }

  private ensureEnglishTab(): void {
    if (!this.languageLibrary || typeof this.languageLibrary !== 'object') {
      this.languageLibrary = { en: [] };
    }
    if (!Array.isArray(this.languageLibrary.en)) {
      this.languageLibrary.en = [];
    }
    if (!this.activeLanguage || !this.languageLibrary[this.activeLanguage]) {
      this.activeLanguage = 'en';
    }
  }

  private getLanguageMeta(code: LanguageCode): SupportedLanguage | null {
    return this.supportedLanguages.find(l => l.code === code) || null;
  }

  private getLanguagesInLibrary(): LanguageCode[] {
    const keys = Object.keys(this.languageLibrary || {});
    const unique = Array.from(new Set(keys));
    unique.sort((a, b) => {
      if (a === 'en') return -1;
      if (b === 'en') return 1;
      const aName = this.getLanguageMeta(a)?.name || a;
      const bName = this.getLanguageMeta(b)?.name || b;
      return aName.localeCompare(bName);
    });
    return unique.length ? unique : ['en'];
  }

  private renderContent(): void {
    if (!this.container) return;
    this.container.innerHTML = '';

    const header = this.createElement('div');
    header.style.cssText = `margin-bottom: var(--settings-spacing-lg);`;

    const title = this.createElement('h2', 'settings-section-header');
    title.textContent = 'Language Library';
    header.appendChild(title);

    const description = this.createElement('p', 'settings-section-description');
    description.textContent =
      'Define custom phrase substitutions (Original → Translated) that apply to transcribed speech before translation and TTS.';
    header.appendChild(description);

    this.container.appendChild(header);
    this.container.appendChild(this.createLanguageTabsRow());
    this.container.appendChild(this.createEntriesPanel());
  }

  private createLanguageTabsRow(): HTMLElement {
    const row = this.createElement('div', 'language-library-lang-tabs');

    const langCodes = this.getLanguagesInLibrary();
    langCodes.forEach(code => {
      const meta = this.getLanguageMeta(code);
      const label = meta ? `${meta.flag} ${meta.name}` : code;

      const btn = this.createElement('button', 'language-library-lang-tab', label) as HTMLButtonElement;
      btn.type = 'button';
      if (code === this.activeLanguage) btn.classList.add('active');
      btn.addEventListener('click', () => {
        this.activeLanguage = code;
        this.renderContent();
      });

      // Optional remove (non-English only)
      if (code !== 'en') {
        const close = this.createElement('span', 'language-library-lang-tab-close', '×');
        close.setAttribute('role', 'button');
        close.setAttribute('aria-label', `Remove ${label} tab`);
        close.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          delete this.languageLibrary[code];
          if (this.activeLanguage === code) this.activeLanguage = 'en';
          this.scheduleAutoSave();
          this.renderContent();
        });
        btn.appendChild(close);
      }

      row.appendChild(btn);
    });

    const addContainer = this.createElement('div', 'language-library-lang-tab-add');

    const addBtn = this.createElement('button', 'language-library-plus', '+') as HTMLButtonElement;
    addBtn.type = 'button';
    addBtn.title = 'Add language tab';

    const picker = this.createElement('select', 'language-library-lang-picker settings-form-select') as HTMLSelectElement;
    picker.style.display = 'none';
    picker.setAttribute('aria-label', 'Add language');

    const existing = new Set(langCodes);
    const available = this.supportedLanguages.filter(l => !existing.has(l.code));

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = available.length ? 'Select a language…' : 'All languages added';
    picker.appendChild(placeholder);

    available.forEach(l => {
      const opt = document.createElement('option');
      opt.value = l.code;
      opt.textContent = `${l.flag} ${l.name}`;
      picker.appendChild(opt);
    });

    addBtn.disabled = !available.length;

    addBtn.addEventListener('click', () => {
      if (picker.style.display === 'none') {
        picker.style.display = 'inline-block';
        picker.focus();
      } else {
        picker.style.display = 'none';
        picker.value = '';
      }
    });

    picker.addEventListener('change', () => {
      const selected = picker.value;
      if (!selected) return;
      if (!this.languageLibrary[selected]) this.languageLibrary[selected] = [];
      this.activeLanguage = selected;
      picker.value = '';
      picker.style.display = 'none';
      this.scheduleAutoSave();
      this.renderContent();
    });

    addContainer.appendChild(addBtn);
    addContainer.appendChild(picker);
    row.appendChild(addContainer);

    return row;
  }

  private createEntriesPanel(): HTMLElement {
    const panel = this.createElement('div', 'language-library-entries');

    const langMeta = this.getLanguageMeta(this.activeLanguage);
    const subtitle = this.createElement(
      'div',
      'language-library-subtitle',
      langMeta ? `Editing: ${langMeta.flag} ${langMeta.name}` : `Editing: ${this.activeLanguage}`
    );
    panel.appendChild(subtitle);

    const table = this.createElement('div', 'language-library-table');

    const headerRow = this.createElement('div', 'language-library-row language-library-header');
    headerRow.appendChild(this.createElement('div', 'language-library-cell', 'Original'));
    headerRow.appendChild(this.createElement('div', 'language-library-cell', 'Translated'));
    headerRow.appendChild(this.createElement('div', 'language-library-cell language-library-actions', ''));
    table.appendChild(headerRow);

    const entries = this.languageLibrary[this.activeLanguage] || [];
    entries.forEach((entry, index) => {
      table.appendChild(this.createEntryRow(entry, index));
    });

    panel.appendChild(table);

    const actions = this.createElement('div', 'language-library-actions-row');
    const addEntryBtn = this.createElement('button', 'settings-button settings-button-secondary', 'Add Entry') as HTMLButtonElement;
    addEntryBtn.type = 'button';
    addEntryBtn.addEventListener('click', () => {
      if (!this.languageLibrary[this.activeLanguage]) this.languageLibrary[this.activeLanguage] = [];
      this.languageLibrary[this.activeLanguage].push({ original: '', translated: '' });
      this.scheduleAutoSave();
      this.renderContent();
      setTimeout(() => {
        const lastOriginal = this.container?.querySelector(
          `input[data-lang="${this.activeLanguage}"][data-field="original"][data-index="${this.languageLibrary[this.activeLanguage].length - 1}"]`
        ) as HTMLInputElement | null;
        lastOriginal?.focus();
      }, 0);
    });
    actions.appendChild(addEntryBtn);
    panel.appendChild(actions);

    const tip = this.createElement(
      'div',
      'language-library-tip',
      'Tip: Matches are case-insensitive and replace exact phrases anywhere in the transcription.'
    );
    panel.appendChild(tip);

    return panel;
  }

  private createEntryRow(entry: LanguageLibraryEntry, index: number): HTMLElement {
    const row = this.createElement('div', 'language-library-row');

    const originalWrap = this.createElement('div', 'language-library-cell');
    const original = document.createElement('input');
    original.type = 'text';
    original.value = entry.original || '';
    original.placeholder = 'e.g. hello';
    original.className = 'language-library-input settings-form-input';
    original.dataset.lang = this.activeLanguage;
    original.dataset.index = String(index);
    original.dataset.field = 'original';
    original.addEventListener('input', () => {
      const idx = Number(original.dataset.index);
      if (!Number.isFinite(idx)) return;
      this.languageLibrary[this.activeLanguage][idx].original = original.value;
      this.scheduleAutoSave();
    });
    originalWrap.appendChild(original);

    const translatedWrap = this.createElement('div', 'language-library-cell');
    const translated = document.createElement('input');
    translated.type = 'text';
    translated.value = entry.translated || '';
    translated.placeholder = 'e.g. hey';
    translated.className = 'language-library-input settings-form-input';
    translated.dataset.lang = this.activeLanguage;
    translated.dataset.index = String(index);
    translated.dataset.field = 'translated';
    translated.addEventListener('input', () => {
      const idx = Number(translated.dataset.index);
      if (!Number.isFinite(idx)) return;
      this.languageLibrary[this.activeLanguage][idx].translated = translated.value;
      this.scheduleAutoSave();
    });
    translatedWrap.appendChild(translated);

    const actions = this.createElement('div', 'language-library-cell language-library-actions');
    const removeBtn = this.createElement(
      'button',
      'settings-button settings-button-secondary language-library-remove',
      'Remove'
    ) as HTMLButtonElement;
    removeBtn.type = 'button';
    removeBtn.addEventListener('click', () => {
      this.languageLibrary[this.activeLanguage].splice(index, 1);
      this.scheduleAutoSave();
      this.renderContent();
    });
    actions.appendChild(removeBtn);

    row.appendChild(originalWrap);
    row.appendChild(translatedWrap);
    row.appendChild(actions);
    return row;
  }

  private scheduleAutoSave(): void {
    this.saveToLocalStorage();
    if (this.autoSaveTimer) window.clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = window.setTimeout(() => this.flushAutoSave(), 750);
  }

  private async flushAutoSave(): Promise<void> {
    if (this.autoSaveTimer) {
      window.clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }

    const cleaned = this.getCleanLibrary();
    const serialized = JSON.stringify(cleaned);
    if (serialized === this.lastSavedSerialized) return;
    this.lastSavedSerialized = serialized;

    try {
      if ((window as any).electronAPI?.invoke) {
        await (window as any).electronAPI.invoke('config:set', {
          id: Date.now().toString(),
          timestamp: Date.now(),
          payload: { languageLibrary: cleaned }
        });
      }
    } catch (error) {
      console.error('Failed to auto-save language library to config:', error);
    }
  }

  private saveToLocalStorage(): void {
    try {
      const cleaned = this.getCleanLibrary();
      localStorage.setItem(this.localStorageKey, JSON.stringify(cleaned));
    } catch (error) {
      console.warn('Failed to save language library to localStorage:', error);
    }
  }

  private loadFromLocalStorage(): LanguageLibrary | null {
    try {
      const raw = localStorage.getItem(this.localStorageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed as LanguageLibrary;
    } catch {
      return null;
    }
  }

  private async loadLibrary(): Promise<void> {
    // Prefer localStorage for immediate persistence when closing settings without pressing Save.
    const local = this.loadFromLocalStorage();
    if (local) {
      this.languageLibrary = local;
      return;
    }

    try {
      const response = await (window as any).electronAPI.invoke('config:get', {
        id: Date.now().toString(),
        timestamp: Date.now()
      });

      const cfg = response?.payload;
      const lib = cfg?.languageLibrary;

      if (lib && typeof lib === 'object') {
        this.languageLibrary = lib;
      } else {
        this.languageLibrary = { en: [] };
      }

      this.saveToLocalStorage();
    } catch (error) {
      console.error('Failed to load language library:', error);
      this.languageLibrary = { en: [] };
    }
  }

  public async onSave(): Promise<boolean> {
    try {
      const cleaned = this.getCleanLibrary();
      try {
        localStorage.setItem(this.localStorageKey, JSON.stringify(cleaned));
      } catch {}

      await (window as any).electronAPI.invoke('config:set', {
        id: Date.now().toString(),
        timestamp: Date.now(),
        payload: { languageLibrary: cleaned }
      });
      return true;
    } catch (error) {
      console.error('Failed to save language library:', error);
      return false;
    }
  }

  public validate(): boolean {
    return this.getValidationErrors().length === 0;
  }

  public getValidationErrors(): string[] {
    const errors: string[] = [];
    const cleaned = this.getCleanLibrary(false);
    const languages = Object.keys(cleaned);

    if (!languages.includes('en')) {
      errors.push('English (en) tab must exist.');
    }

    for (const [lang, entries] of Object.entries(cleaned)) {
      if (!Array.isArray(entries)) continue;
      entries.forEach((e, i) => {
        const o = (e.original || '').trim();
        const t = (e.translated || '').trim();
        if (!o && !t) return;
        if (!o) errors.push(`Missing Original for ${lang} entry #${i + 1}`);
        if (!t) errors.push(`Missing Translated for ${lang} entry #${i + 1}`);
      });
    }

    return errors;
  }

  private getCleanLibrary(omitBlankRows: boolean = true): LanguageLibrary {
    const result: LanguageLibrary = {};
    const lib = this.languageLibrary || {};

    for (const [lang, entries] of Object.entries(lib)) {
      if (!Array.isArray(entries)) continue;
      const cleaned = entries
        .map(e => ({
          original: (e.original || '').trim(),
          translated: (e.translated || '').trim()
        }))
        .filter(e => {
          if (!omitBlankRows) return true;
          return e.original.length > 0 || e.translated.length > 0;
        });

      result[lang] = cleaned;
    }

    if (!result.en) result.en = [];
    return result;
  }
}


