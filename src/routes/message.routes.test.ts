import { describe, expect, it } from 'vitest';
import router from './message.routes';

describe('message routes', () => {
  it('registers /history before /:messageId so history is not treated as an id', () => {
    const paths = router.stack
      .map((layer: any) => layer.route?.path)
      .filter(Boolean);

    expect(paths.indexOf('/history')).toBeLessThan(paths.indexOf('/:messageId'));
  });
});
