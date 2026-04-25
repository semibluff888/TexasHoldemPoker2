import test from 'node:test';
import assert from 'node:assert/strict';

import { createServerConfig } from '../../server/config.js';

test('createServerConfig defaults the online hand restart delay to six seconds', () => {
    const config = createServerConfig();

    assert.equal(config.autoRestartDelayMs, 6000);
});
