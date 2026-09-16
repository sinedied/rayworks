import { describe, it, expect } from 'vitest';

import { isWriteSucceededButUnreadable } from '../services/rayfin/RayfinResponseService';

describe('isWriteSucceededButUnreadable', () => {
  it('recognises the DAB anonymous read-back denial', () => {
    const error = new Error(
      'GraphQL errors: The mutation operation createFormResponse was successful ' +
        'but the current user is unauthorized to view the response due to lack of read permissions'
    );
    expect(isWriteSucceededButUnreadable(error)).toBe(true);
  });

  it('does not swallow a genuine authorization failure', () => {
    const error = new Error(
      'GraphQL errors: The current user is not authorized to access this resource.'
    );
    expect(isWriteSucceededButUnreadable(error)).toBe(false);
  });

  it('does not swallow arbitrary errors', () => {
    expect(isWriteSucceededButUnreadable(new Error('Network failure'))).toBe(
      false
    );
    expect(isWriteSucceededButUnreadable('not an error')).toBe(false);
    expect(isWriteSucceededButUnreadable(null)).toBe(false);
  });
});
