/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

/**
 * Log entry interface
 */
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  userId?: string;
  model?: string;
  provider?: string;
  duration?: number;
  statusCode?: number;
  error?: any;
  metadata?: Record<string, any>;
}

/**
 * Structured logger for CloudWatch
 */
export class Logger {
  private requestId?: string;
  private userId?: string;
  private readonly logLevel: LogLevel;

  constructor(requestId?: string, userId?: string) {
    this.requestId = requestId;
    this.userId = userId;
    this.logLevel = this.getLogLevel();
  }

  /**
   * Creates a new logger instance with request context
   */
  static withContext(requestId?: string, userId?: string): Logger {
    return new Logger(requestId, userId);
  }

  /**
   * Logs debug messages
   */
  debug(message: string, metadata?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.log(LogLevel.DEBUG, message, metadata);
    }
  }

  /**
   * Logs info messages
   */
  info(message: string, metadata?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.log(LogLevel.INFO, message, metadata);
    }
  }

  /**
   * Logs warning messages
   */
  warn(message: string, metadata?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.log(LogLevel.WARN, message, metadata);
    }
  }

  /**
   * Logs error messages
   */
  error(message: string, error?: any, metadata?: Record<string, any>): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.log(LogLevel.ERROR, message, { ...metadata, error: this.sanitizeError(error) });
    }
  }

  /**
   * Logs API request start
   */
  logRequestStart(method: string, path: string, model?: string): void {
    this.info('API request started', {
      method,
      path,
      model,
      type: 'request_start'
    });
  }

  /**
   * Logs API request completion
   */
  logRequestEnd(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    model?: string,
    provider?: string
  ): void {
    this.info('API request completed', {
      method,
      path,
      statusCode,
      duration,
      model,
      provider,
      type: 'request_end'
    });
  }

  /**
   * Logs model invocation
   */
  logModelInvocation(
    model: string,
    provider: string,
    inputTokens?: number,
    outputTokens?: number,
    duration?: number
  ): void {
    this.info('Model invocation', {
      model,
      provider,
      inputTokens,
      outputTokens,
      duration,
      type: 'model_invocation'
    });
  }

  /**
   * Logs authentication events
   */
  logAuth(success: boolean, reason?: string): void {
    this.info('Authentication attempt', {
      success,
      reason,
      type: 'authentication'
    });
  }

  /**
   * Logs configuration loading
   */
  logConfigLoad(source: string, success: boolean, error?: any): void {
    this.info('Configuration loaded', {
      source,
      success,
      error: error ? this.sanitizeError(error) : undefined,
      type: 'config_load'
    });
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, metadata?: Record<string, any>): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      requestId: this.requestId,
      userId: this.userId,
      ...metadata
    };

    // Remove undefined values
    Object.keys(logEntry).forEach(key => {
      if (logEntry[key as keyof LogEntry] === undefined) {
        delete logEntry[key as keyof LogEntry];
      }
    });

    // Output structured JSON for CloudWatch
    console.log(JSON.stringify(logEntry));
  }

  /**
   * Determines if a log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);

    return messageLevelIndex >= currentLevelIndex;
  }

  /**
   * Gets the current log level from environment
   */
  private getLogLevel(): LogLevel {
    const envLogLevel = process.env.LOG_LEVEL?.toUpperCase();

    switch (envLogLevel) {
      case 'DEBUG':
        return LogLevel.DEBUG;
      case 'INFO':
        return LogLevel.INFO;
      case 'WARN':
        return LogLevel.WARN;
      case 'ERROR':
        return LogLevel.ERROR;
      default:
        return process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG;
    }
  }

  /**
   * Sanitizes error objects for logging
   */
  private sanitizeError(error: any): any {
    if (!error) return undefined;

    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...(error as any) // Include any additional properties
      };
    }

    if (typeof error === 'object') {
      // Remove sensitive information
      const sanitized = { ...error };

      // List of sensitive keys to remove or mask
      const sensitiveKeys = [
        'password', 'token', 'key', 'secret', 'authorization',
        'x-api-key', 'x-auth-token', 'cookie', 'session'
      ];

      for (const key of sensitiveKeys) {
        if (key in sanitized) {
          sanitized[key] = '[REDACTED]';
        }
      }

      return sanitized;
    }

    return error;
  }
}

/**
 * Performance timer utility
 */
export class PerformanceTimer {
  private startTime: number;
  private logger: Logger;

  constructor(logger: Logger) {
    this.startTime = Date.now();
    this.logger = logger;
  }

  /**
   * Ends the timer and logs the duration
   */
  end(operation: string, metadata?: Record<string, any>): number {
    const duration = Date.now() - this.startTime;

    this.logger.info(`${operation} completed`, {
      duration,
      type: 'performance',
      ...metadata
    });

    return duration;
  }

  /**
   * Gets the current duration without ending the timer
   */
  getDuration(): number {
    return Date.now() - this.startTime;
  }
}

/**
 * Default logger instance
 */
export const logger = new Logger();

/**
 * Creates a performance timer
 */
export function createTimer(logger: Logger = new Logger()): PerformanceTimer {
  return new PerformanceTimer(logger);
}
