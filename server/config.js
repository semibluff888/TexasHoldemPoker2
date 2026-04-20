const DEFAULT_ROOM_CONFIG = {
    name: 'Practice Table',
    maxPlayers: 6,
    smallBlind: 10,
    bigBlind: 20,
    startingChips: 1000,
    actionTimeoutMs: 30000
};

export function createServerConfig(overrides = {}) {
    const roomDefaults = {
        ...DEFAULT_ROOM_CONFIG,
        ...overrides.roomDefaults
    };

    return {
        host: overrides.host ?? '0.0.0.0',
        port: overrides.port ?? Number(process.env.PORT ?? 3000),
        guestPrefix: overrides.guestPrefix ?? 'guest',
        autoStartMinPlayers: overrides.autoStartMinPlayers ?? 2,
        autoRestartDelayMs: overrides.autoRestartDelayMs ?? 1500,
        roomDefaults
    };
}

export function normalizeRoomConfig(config = {}, defaults = DEFAULT_ROOM_CONFIG) {
    return {
        ...defaults,
        ...config
    };
}

export const serverConfig = createServerConfig();
