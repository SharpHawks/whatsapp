import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

describe('auth routes', () => {
  it('verifies bot ownership before regenerating a bot-scoped API key', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/routes/auth.routes.ts'), 'utf8');
    const routeStart = source.indexOf("router.post('/api-keys/regenerate'");
    const ownershipCheck = source.indexOf('botService.getBot(botId, req.userId!)', routeStart);
    const regenerateCall = source.indexOf('authService.regenerateApiKey(req.userId!, botId)', routeStart);

    expect(routeStart).toBeGreaterThanOrEqual(0);
    expect(ownershipCheck).toBeGreaterThan(routeStart);
    expect(ownershipCheck).toBeLessThan(regenerateCall);
  });
});
