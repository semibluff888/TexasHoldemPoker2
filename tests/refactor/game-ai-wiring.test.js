import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('game.js delegates AI decisions to the extracted game-ai module', async () => {
    const source = await readFile(new URL('../../game.js', import.meta.url), 'utf8');

    assert.match(
        source,
        /import\s*\{\s*decideAIAction,\s*getOpponentProfile\s*\}\s*from '\.\/src\/ai\/game-ai\.js';/s
    );
    assert.doesNotMatch(
        source,
        /import\s*\{\s*createDeck,\s*shuffleDeck,\s*getCardValue\s*\}\s*from '\.\/src\/core\/cards\.js';/
    );
    assert.match(source, /function executeAIAction\(playerId, action\)/);
    assert.match(
        source,
        /const action = decideAIAction\(\{\s*gameState,\s*playerId: player\.id\s*\}\);/s
    );
    assert.match(source, /executeAIAction\(player\.id, action\);/);
    assert.doesNotMatch(source, /const BUCKET_PREMIUM =/);
    assert.doesNotMatch(source, /function aiDecision\(/);
    assert.doesNotMatch(source, /function aiDecisionEnhance\(/);
    assert.doesNotMatch(source, /function getOpponentProfile\(/);
});
