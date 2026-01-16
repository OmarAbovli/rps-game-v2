// Game Constants and Configuration

export const SOLDIER_TYPES = {
    ROCK: 'rock',
    PAPER: 'paper',
    SCISSORS: 'scissors'
};

export const GAME_STATES = {
    MENU: 'menu',
    LOBBY: 'lobby',
    PLACEMENT: 'placement',
    PLAYING: 'playing',
    ENDED: 'ended'
};

export const GAME_CONFIG = {
    // Arena - responsive to screen
    ARENA_WIDTH: 40,
    ARENA_HEIGHT: 24,

    // Soldiers - SMALLER sizes
    SOLDIERS_PER_ARMY: 5,
    SOLDIER_BASE_SPEED: 5,
    SOLDIER_SIZE: 0.45,
    LEADER_SIZE: 0.65,
    SOLDIER_COLLISION_RADIUS: 0.5,

    // Speed scaling
    SPEED_PENALTY_PER_SOLDIER: 0.012,
    MIN_SPEED_MULTIPLIER: 0.75,

    // Phases
    PLACEMENT_TIME: 10,

    // Power-ups
    POWERUP_SPAWN_INTERVAL: 8,
    POWERUP_SPAWN_VARIANCE: 3,
    POWERUP_SIZE: 0.6,

    // Following
    FOLLOW_DISTANCE: 1.0,
    FOLLOW_SMOOTHING: 0.15,

    // Network
    SYNC_RATE: 30
};

export const COLORS = {
    rock: {
        main: 0x8B7355,
        light: 0xB09979,
        dark: 0x5D4B3D
    },
    paper: {
        main: 0xFFFAE6,
        light: 0xFFFFFF,
        dark: 0xE6DFC6
    },
    scissors: {
        main: 0xC0C0C0,
        light: 0xE8E8E8,
        dark: 0x808080
    },
    arena: {
        floor: 0x1e272e,
        floorAlt: 0x2d3436,
        wall: 0x636e72,
        wallAccent: 0x4a90a4,
        slowZone: 0x6c5ce7,
        speedZone: 0x00b894,
        spawnRock: 0x6D5E4D,
        spawnPaper: 0xD5D0B5,
        spawnScissors: 0x8A8A8A,
        neutral: 0x1a1a2e
    },
    powerUp: 0xFFE66D
};

export const POWERUP_TYPES = {
    SPEED_BOOST: 'speed_boost',
    INVINCIBILITY: 'invincibility',
    REINFORCEMENT: 'reinforcement',
    MAGNET_AURA: 'magnet_aura',
    SPLIT_FORMATION: 'split_formation',
    CLONE_LEADER: 'clone_leader',
    REVERSE_CONTROL: 'reverse_control'
};

export const POWERUP_CONFIG = {
    speed_boost: {
        duration: 5,
        multiplier: 1.6,
        icon: '⚡',
        color: 0x00ff88,
        shape: 'lightning' // Bolt shape
    },
    invincibility: {
        duration: 4,
        icon: '🛡️',
        color: 0xffd700,
        shape: 'shield' // Shield shape
    },
    reinforcement: {
        soldiersToRestore: 2,
        icon: '👥',
        color: 0x00ccff,
        shape: 'plus' // Plus sign
    },
    magnet_aura: {
        duration: 4,
        range: 5,
        icon: '🧲',
        color: 0xff00ff,
        shape: 'magnet' // U-shape magnet
    },
    split_formation: {
        duration: 2,
        icon: '💫',
        color: 0xff6b6b,
        shape: 'star' // Star burst
    },
    clone_leader: {
        duration: 6,
        icon: '👤',
        color: 0x9b59b6,
        shape: 'person' // Person silhouette
    },
    reverse_control: {
        duration: 2,
        icon: '🔄',
        color: 0xff4500,
        shape: 'arrows' // Rotating arrows
    }
};

export const TYPE_ICONS = {
    rock: '🪨',
    paper: '📄',
    scissors: '✂️'
};
