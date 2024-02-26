export enum LoggingLevel {
  TRACE = 5,
  DEBUG = 4,
  INFO = 3,
  WARN = 2,
  ERROR = 1,
  NONE = 0,
}

let loggingLevel: LoggingLevel = LoggingLevel.WARN;
export function setLoggingLevel(level: LoggingLevel) {
  loggingLevel = level;
}

export function log(
  level: LoggingLevel,
  message: string,
  ...params: unknown[]
): void {
  if (level <= loggingLevel) {
    let logger: (typeof console)['log'];
    switch (level) {
      case LoggingLevel.INFO:
        logger = console.info;
        break;
      case LoggingLevel.WARN:
        logger = console.warn;
        break;
      case LoggingLevel.ERROR:
        logger = console.error;
        break;
      default:
        logger = console.log;
        break;
    }
    logger(message, ...params.map(p => (typeof p === 'function' ? p() : p)));
  }
}

export function trace(message: string, ...params: unknown[]) {
  log(LoggingLevel.TRACE, message, ...params);
}
export function debug(message: string, ...params: unknown[]) {
  log(LoggingLevel.DEBUG, message, ...params);
}
export function info(message: string, ...params: unknown[]) {
  log(LoggingLevel.INFO, message, ...params);
}
export function warn(message: string, ...params: unknown[]) {
  log(LoggingLevel.WARN, message, ...params);
}
export function error(message: string, ...params: unknown[]) {
  log(LoggingLevel.ERROR, message, ...params);
}
