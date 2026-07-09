import { describe, expect, it, vi } from 'vitest';
import { installExtensionNoiseFilter } from './extensionNoiseFilter';

describe('extensionNoiseFilter', () => {
  it('suppresses known extension messaging rejections', () => {
    installExtensionNoiseFilter();
    const preventDefault = vi.fn();
    const event = new PromiseRejectionEvent('unhandledrejection', {
      promise: Promise.resolve(),
      reason: new Error(
        'A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received',
      ),
    });
    Object.defineProperty(event, 'preventDefault', { value: preventDefault });

    window.dispatchEvent(event);

    expect(preventDefault).toHaveBeenCalled();
  });
});
