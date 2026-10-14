export function validateBackendEnvironment(env: NodeJS.ProcessEnv = process.env): string[] {
  const errors: string[] = [];
  if (!env.MONGODB_URI?.trim()) errors.push('MONGODB_URI is required.');
  if (env.NODE_ENV === 'production' && !env.CORS_ALLOWED_ORIGINS?.trim()) errors.push('CORS_ALLOWED_ORIGINS is required in production.');
  return errors;
}