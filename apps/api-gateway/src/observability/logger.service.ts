import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import * as winston from 'winston';

@Injectable()
export class LoggerService implements NestLoggerService {
  private readonly logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL ?? 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        process.env.NODE_ENV === 'production'
          ? winston.format.json()
          : winston.format.combine(
              winston.format.colorize(),
              winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
                const ctx = context ? `[${context}] ` : '';
                const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
                return `${timestamp} ${level} ${ctx}${message}${metaStr}`;
              }),
            ),
      ),
      transports: [
        new winston.transports.Console(),
        ...(process.env.LOG_FILE
          ? [
              new winston.transports.File({ filename: process.env.LOG_FILE, maxsize: 50 * 1024 * 1024, maxFiles: 5 }),
              new winston.transports.File({ filename: 'logs/error.log', level: 'error', maxsize: 10 * 1024 * 1024, maxFiles: 3 }),
            ]
          : []),
      ],
    });
  }

  log(message: string, context?: string) {
    this.logger.info(message, { context });
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error(message, { trace, context });
  }

  warn(message: string, context?: string) {
    this.logger.warn(message, { context });
  }

  debug(message: string, context?: string) {
    this.logger.debug(message, { context });
  }

  verbose(message: string, context?: string) {
    this.logger.verbose(message, { context });
  }

  withContext(context: string) {
    return {
      log: (msg: string, meta?: object) => this.logger.info(msg, { context, ...meta }),
      error: (msg: string, meta?: object) => this.logger.error(msg, { context, ...meta }),
      warn: (msg: string, meta?: object) => this.logger.warn(msg, { context, ...meta }),
      debug: (msg: string, meta?: object) => this.logger.debug(msg, { context, ...meta }),
    };
  }
}
