export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

export interface LogEntry {
    timestamp: number;
    level: LogLevel;
    component: string;
    message: string;
    data?: any;
}

/**
 * Simple logging service for debugging and monitoring
 */
export class LoggingService {
    private static instance: LoggingService;
    private logs: LogEntry[] = [];
    private maxLogs: number = 1000;
    private logLevel: LogLevel = LogLevel.DEBUG;

    private constructor() {}

    static getInstance(): LoggingService {
        if (!LoggingService.instance) {
            LoggingService.instance = new LoggingService();
        }
        return LoggingService.instance;
    }

    debug(component: string, message: string, data?: any): void {
        this.log(LogLevel.DEBUG, component, message, data);
    }

    info(component: string, message: string, data?: any): void {
        this.log(LogLevel.INFO, component, message, data);
    }

    warn(component: string, message: string, data?: any): void {
        this.log(LogLevel.WARN, component, message, data);
    }

    error(component: string, message: string, data?: any): void {
        this.log(LogLevel.ERROR, component, message, data);
    }

    private log(level: LogLevel, component: string, message: string, data?: any): void {
        if (level < this.logLevel) {
            return;
        }

        const entry: LogEntry = {
            timestamp: Date.now(),
            level,
            component,
            message,
            data
        };

        this.logs.push(entry);

        // Keep only the most recent logs
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }

        // Also log to console in development
        if (process.env.NODE_ENV === 'development') {
            const levelName = LogLevel[level];
            const timestamp = new Date(entry.timestamp).toLocaleTimeString();
            console.log(`[${timestamp}] ${levelName} [${component}] ${message}`, data || '');
        }
    }

    getLogs(level?: LogLevel, component?: string): LogEntry[] {
        let filteredLogs = this.logs;

        if (level !== undefined) {
            filteredLogs = filteredLogs.filter(log => log.level >= level);
        }

        if (component) {
            filteredLogs = filteredLogs.filter(log => log.component === component);
        }

        return filteredLogs;
    }

    clearLogs(): void {
        this.logs = [];
    }

    setLogLevel(level: LogLevel): void {
        this.logLevel = level;
    }

    getLogLevel(): LogLevel {
        return this.logLevel;
    }
}