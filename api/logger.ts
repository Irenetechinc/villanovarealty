// Export simple logger for server terminal output
export const logActivity = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌ [ERROR]' : type === 'success' ? '✅ [SUCCESS]' : 'ℹ️ [INFO]';
  console.log(`${prefix} ${timestamp}: ${message}`);
};
