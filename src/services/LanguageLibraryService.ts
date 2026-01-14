/**
 * LanguageLibraryService
 *
 * Applies user-defined phrase substitutions (Original -> Translated) to text.
 * Intended usage: apply to transcribed text BEFORE translation/TTS.
 *
 * Matching behavior:
 * - Case-insensitive exact phrase match
 * - Replace all occurrences
 * - Deterministic order (longest originals first)
 */

export interface LanguageLibraryEntry {
  original: string;
  translated: string;
}

export type LanguageLibrary = Record<string, LanguageLibraryEntry[]>;

export class LanguageLibraryService {
  /**
   * Normalize language identifiers (e.g. 'english' -> 'en').
   * Falls back to lowercased string.
   */
  public static normalizeLanguageCode(lang: string | undefined | null): string | undefined {
    if (!lang) return undefined;
    const lower = String(lang).trim().toLowerCase();
    if (!lower) return undefined;

    const map: Record<string, string> = {
      english: 'en',
      en: 'en',
      russian: 'ru',
      ru: 'ru',
      spanish: 'es',
      es: 'es',
      french: 'fr',
      fr: 'fr',
      german: 'de',
      de: 'de',
      italian: 'it',
      it: 'it',
      portuguese: 'pt',
      pt: 'pt',
      japanese: 'ja',
      ja: 'ja',
      korean: 'ko',
      ko: 'ko',
      chinese: 'zh',
      zh: 'zh',
      'simplified chinese': 'zh',
      'traditional chinese': 'zh',
      arabic: 'ar',
      ar: 'ar',
      hindi: 'hi',
      hi: 'hi',
      thai: 'th',
      th: 'th',
      vietnamese: 'vi',
      vi: 'vi',
      turkish: 'tr',
      tr: 'tr',
      polish: 'pl',
      pl: 'pl',
      dutch: 'nl',
      nl: 'nl',
      swedish: 'sv',
      sv: 'sv',
      danish: 'da',
      da: 'da',
      norwegian: 'no',
      no: 'no'
    };

    return map[lower] || lower;
  }

  public static applyToText(
    text: string,
    language: string | undefined | null,
    languageLibrary: LanguageLibrary | undefined
  ): string {
    if (!text || typeof text !== 'string') return text;
    if (!languageLibrary || typeof languageLibrary !== 'object') return text;

    const normalized = this.normalizeLanguageCode(language);
    if (!normalized || normalized === 'auto' || normalized === 'unknown') return text;

    const entries = languageLibrary[normalized];
    if (!Array.isArray(entries) || entries.length === 0) return text;

    const cleaned = entries
      .map(e => ({
        original: (e?.original || '').trim(),
        translated: (e?.translated || '').trim()
      }))
      .filter(e => e.original.length > 0 && e.translated.length > 0)
      .sort((a, b) => b.original.length - a.original.length);

    if (cleaned.length === 0) return text;

    let out = text;
    for (const { original, translated } of cleaned) {
      const pattern = new RegExp(this.escapeRegExp(original), 'gi');
      out = out.replace(pattern, translated);
    }
    return out;
  }

  private static escapeRegExp(input: string): string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}


