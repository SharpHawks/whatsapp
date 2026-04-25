import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

describe('Stripe webhook body parsing', () => {
  it('mounts billing webhook with express.raw before global JSON parsing', () => {
    const indexSource = fs.readFileSync(path.join(process.cwd(), 'src/index.ts'), 'utf8');

    expect(indexSource).toContain('express.raw');
    expect(indexSource).toContain('isStripeWebhookRequest(req) ? next() : sanitizeInputs');
    expect(indexSource.indexOf('/billing/webhook')).toBeLessThan(indexSource.indexOf('express.json'));
  });
});
