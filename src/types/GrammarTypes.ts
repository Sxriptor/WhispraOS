/**
 * Grammar checking types and interfaces
 */

export interface GrammarMatch {
  /** Character offset where the error starts */
  offset: number;
  /** Length of the error in characters */
  length: number;
  /** Error message describing the issue */
  message: string;
  /** Short error message */
  shortMessage: string;
  /** Suggested replacements */
  replacements: Array<{
    value: string;
  }>;
  /** Context information */
  context: {
    text: string;
    offset: number;
    length: number;
  };
  /** Rule ID that triggered this match */
  rule: {
    id: string;
    description: string;
    issueType: string;
    category: {
      id: string;
      name: string;
    };
  };
}

export interface GrammarCheckResult {
  /** Array of grammar matches found */
  matches: GrammarMatch[];
  /** Language used for checking */
  language: {
    code: string;
    name: string;
  };
  /** Software version information */
  software: {
    name: string;
    version: string;
    buildDate: string;
    apiVersion: number;
    status: string;
    premium: boolean;
  };
}

export interface GrammarCheckRequest {
  /** Text to check */
  text: string;
  /** Language code (e.g., 'en', 'en-US', 'es') */
  language?: string;
}

export interface GrammarCheckResponse {
  /** Whether the check was successful */
  success: boolean;
  /** Grammar check results if successful */
  result?: GrammarCheckResult;
  /** Error message if check failed */
  error?: string;
}

