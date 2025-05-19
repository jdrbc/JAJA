import log from 'loglevel';

// Configure logger based on environment
const isDevelopment = process.env.NODE_ENV === 'development';

// Set log level based on environment
if (isDevelopment) {
  log.setLevel('debug');
} else {
  log.setLevel('warn'); // Only show warnings and errors in production
}

// Create a logger interface that matches common usage patterns
export const logger = {
  debug: (...args: any[]) => log.debug(...args),
  info: (...args: any[]) => log.info(...args),
  warn: (...args: any[]) => log.warn(...args),
  error: (...args: any[]) => log.error(...args),
  log: (...args: any[]) => log.info(...args), // Map logger.log to info
};

export default logger;
