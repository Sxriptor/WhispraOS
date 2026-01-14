/**
 * Fuzzy Text Matching Utilities
 * Implements Levenshtein distance and similarity matching for cache lookups
 */

export class FuzzyMatcher {
  /**
   * Calculate Levenshtein distance between two strings
   */
  static levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix: number[][] = [];

    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j] + 1,     // deletion
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j - 1] + 1  // substitution
          );
        }
      }
    }

    return matrix[len1][len2];
  }

  /**
   * Calculate similarity ratio between two strings (0-1)
   */
  static similarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    if (str1.length === 0 || str2.length === 0) return 0.0;

    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    return 1 - (distance / maxLength);
  }

  /**
   * Check if two strings are similar above threshold
   */
  static isSimilar(str1: string, str2: string, threshold: number = 0.8): boolean {
    return this.similarity(str1, str2) >= threshold;
  }

  /**
   * Find best matching string from array
   */
  static findBestMatch(
    query: string,
    candidates: string[],
    threshold: number = 0.8
  ): { text: string; similarity: number } | null {
    let bestMatch: { text: string; similarity: number } | null = null;
    let bestSimilarity = threshold;

    for (const candidate of candidates) {
      const sim = this.similarity(query, candidate);
      if (sim > bestSimilarity) {
        bestSimilarity = sim;
        bestMatch = { text: candidate, similarity: sim };
      }
    }

    return bestMatch;
  }

  /**
   * Normalize text for better matching (lowercase, trim, remove punctuation)
   */
  static normalize(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ');
  }

  /**
   * Calculate normalized similarity
   */
  static normalizedSimilarity(str1: string, str2: string): number {
    return this.similarity(this.normalize(str1), this.normalize(str2));
  }
}

