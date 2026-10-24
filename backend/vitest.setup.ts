import { beforeEach } from 'vitest';
import { register } from 'prom-client';

// Clear prom-client registry between test files to avoid
// "metric already registered" errors when multiple test files
// import the metrics module.
beforeEach(() => {
  register.clear();
});
