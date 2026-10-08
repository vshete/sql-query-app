// Set once by the custom server, before Next prepares either API route.
export function configureMockModelMode(dev: boolean): void {
  const requested = process.argv.includes('--mockModel')
    || process.env.npm_config_mockModel === 'true'
    || process.env.npm_config_mockmodel === 'true';
  process.env.QUERY_APP_MOCK_MODEL = dev && requested ? 'true' : 'false';
  if (dev && requested) console.log('Mock model enabled; PostgreSQL queries remain live.');
}

export function isMockModelEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.QUERY_APP_MOCK_MODEL === 'true';
}
