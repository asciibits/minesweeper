import { LoggingLevel, setLoggingLevel } from './logging.js';

/** Global beforeEach to disable logging */
beforeEach(() => {
  setLoggingLevel(LoggingLevel.NONE);
});
