import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('game.js wires the browser client through GameEngine events and submitAction', async () => {
    const source = await readFile(new URL('../../game.js', import.meta.url), 'utf8');

    assert.match(
        source,
        /import\s*\{\s*GameEngine\s*\}\s*from '\.\/src\/engine\/game-engine\.js';/
    );
    assert.match(source, /engine\.startHand\(\{\s*randomizeDealer\s*\}\);/);
    assert.match(source, /engine\.submitAction\(0,\s*\{\s*type:\s*'fold'\s*\}\);/);
    assert.match(source, /engine\.submitAction\(0,\s*\{\s*type:\s*'check'\s*\}\);/);
    assert.match(source, /engine\.submitAction\(0,\s*\{\s*type:\s*'call'\s*\}\);/);
    assert.match(
        source,
        /engine\.submitAction\(0,\s*\{\s*type:\s*'raise',\s*totalBet:\s*raiseAmount\s*\}\);/
    );
    assert.match(source, /engine\.submitAction\(0,\s*\{\s*type:\s*'allin'\s*\}\);/);
    assert.match(source, /engine\.on\('action_required',\s*(?:async\s*)?\(/);
    assert.match(
        source,
        /engine\.on\('action_executed',\s*\(\{\s*playerId,\s*action,\s*playerState,\s*chipsBeforeAction\s*\}\)\s*=>\s*\{/s
    );
    assert.match(
        source,
        /else if \(action\.type === 'raise'\) \{\s*showAction\(playerId,\s*`\$\{t\('actionRaise'\)\} \$\$\{action\.totalBet\}`,\s*chipsBeforeAction\);/s
    );
    assert.match(
        source,
        /else if \(action\.type === 'allin'\) \{\s*showAction\(playerId,\s*t\('actionAllIn'\),\s*chipsBeforeAction\);/s
    );
    assert.match(
        source,
        /const action = decideAIAction\(\{\s*gameState,\s*playerId: player\.id\s*\}\);/s
    );
    assert.match(source, /engine\.submitAction\(player\.id,\s*action\);/);
    assert.match(source, /engine\.removePlayer\(playerId\);/);
    assert.match(source, /engine\.restorePlayer\(\{/);
    assert.match(source, /engine\.cycleAILevel\(playerId\);/);
    assert.doesNotMatch(source, /function dealCard\(/);
    assert.doesNotMatch(source, /function getDealingOrder\(/);
    assert.doesNotMatch(source, /async function dealHoleCards\(/);
    assert.doesNotMatch(source, /function playerFold\(/);
    assert.doesNotMatch(source, /function playerCheck\(/);
    assert.doesNotMatch(source, /function playerCall\(/);
    assert.doesNotMatch(source, /function playerRaise\(/);
    assert.doesNotMatch(source, /function playerAllIn\(/);
    assert.doesNotMatch(source, /function executeAIAction\(/);
    assert.doesNotMatch(source, /function nextPlayer\(/);
    assert.doesNotMatch(source, /function getActivePlayers\(/);
    assert.doesNotMatch(source, /async function runBettingRound\(/);
    assert.doesNotMatch(source, /function waitForPlayerAction\(/);
    assert.doesNotMatch(source, /function resolvePlayerAction\(/);
    assert.doesNotMatch(source, /function getNextActivePlayer\(/);
    assert.doesNotMatch(source, /function postBlind\(/);
    assert.doesNotMatch(source, /async function dealFlop\(/);
    assert.doesNotMatch(source, /async function dealTurn\(/);
    assert.doesNotMatch(source, /async function dealRiver\(/);
    assert.doesNotMatch(source, /async function showdown\(/);
});
