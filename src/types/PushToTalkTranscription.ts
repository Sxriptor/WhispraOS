export interface PushToTalkTranscription {
    text: string;
    language?: string;
    duration?: number;
    skipped?: boolean;
    reason?: string;
    expectedLanguage?: string;
}


