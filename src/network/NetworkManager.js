// NetworkManager - Cloud Relay Version (100% Guaranteed Connection)
import { SOLDIER_TYPES, GAME_CONFIG } from '../utils/constants.js';
import { IdentityService, RealtimeService } from '../services/SupabaseClient.js';

export class NetworkManager {
    constructor(app) {
        this.app = app;
        this.isHost = false;
        this.partyId = null;
        this.localPlayerType = null;
        this.syncInterval = null;

        // Player data
        this.players = new Map();
        this.remoteInputs = new Map();
        this.connections = new Map(); // Kept as presence map
    }

    createParty() {
        this.partyId = this.generatePartyId();
        this.isHost = true;
        this.localPlayerType = SOLDIER_TYPES.ROCK;

        console.log(`--- 🏘️ CREATING CLOUD PARTY: ${this.partyId} ---`);

        // Join Cloud Relay
        RealtimeService.joinChannel(this.partyId, (data) => this.handleMessage(data));

        // Register local player
        this.players.set(this.localPlayerType, {
            id: IdentityService.currentUser.id,
            username: IdentityService.currentUser.username,
            connected: true
        });

        this.app.ui.showLobby(this.partyId, this.localPlayerType);
        this.updatePlayerList();
        this.startHostSync();
    }

    joinParty(partyId) {
        this.partyId = partyId.toUpperCase();
        this.isHost = false;

        console.log(`--- 🚀 JOINING CLOUD PARTY: ${this.partyId} ---`);

        // Join Cloud Relay
        RealtimeService.joinChannel(this.partyId, (data) => this.handleMessage(data));

        // Send Join Request via Relay (Queued internally until ready)
        this.broadcast({
            type: 'join_request',
            id: IdentityService.currentUser.id,
            username: IdentityService.currentUser.username
        });
    }

    handleMessage(data) {
        // If we get our own broadcasted message, ignore it
        if (data.fromId === IdentityService.currentUser.id) return;

        switch (data.type) {
            case 'join_request':
                if (this.isHost) {
                    const assignedType = this.getNextAvailableType();
                    if (assignedType) {
                        this.players.set(assignedType, {
                            id: data.id,
                            username: data.username,
                            connected: true
                        });

                        this.broadcast({
                            type: 'player_assigned',
                            targetId: data.id,
                            playerType: assignedType,
                            players: this.getPlayersArray()
                        });

                        this.updatePlayerList();
                    } else {
                        this.broadcast({ type: 'party_full', targetId: data.id });
                    }
                }
                break;

            case 'player_assigned':
                if (data.targetId === IdentityService.currentUser.id) {
                    this.localPlayerType = data.playerType;
                    this.syncPlayersFromArray(data.players);
                    this.app.ui.showLobby(this.partyId, this.localPlayerType);
                    this.app.ui.hideJoinModal();
                    this.updatePlayerList();
                } else {
                    // Other players see a new person joined
                    this.syncPlayersFromArray(data.players);
                    this.updatePlayerList();
                }
                break;

            case 'game_start':
                this.handleGameStart(data);
                break;

            case 'player_input':
                if (this.isHost) {
                    this.remoteInputs.set(data.playerType, { x: data.x, z: data.z });
                }
                break;

            case 'game_state':
                this.handleGameStateSync(data);
                break;

            case 'conversion':
                this.handleRemoteConversion(data);
                break;

            case 'game_over':
                this.app.game.endGame(data.winner);
                break;

            case 'player_left':
                this.handlePeerDisconnect(data.fromId);
                break;

            case 'party_full':
                if (data.targetId === IdentityService.currentUser.id) {
                    alert('Party is full!');
                    this.leaveParty();
                }
                break;
        }
    }

    broadcast(data) {
        // Add sender info
        data.fromId = IdentityService.currentUser.id;
        RealtimeService.broadcast(data);
    }

    sendInput(input) {
        if (this.isHost) return;
        this.broadcast({
            type: 'player_input',
            playerType: this.localPlayerType,
            x: input.x,
            z: input.z
        });
    }

    // Host broadcasts full game state periodically
    startHostSync() {
        if (!this.isHost) return;
        if (this.syncInterval) clearInterval(this.syncInterval);

        this.syncInterval = setInterval(() => {
            if (this.app.game.state !== 'playing') return;

            const gameState = {
                type: 'game_state',
                armies: {}
            };

            this.app.game.armies.forEach((army, type) => {
                const soldiersData = army.soldiers.map(s => ({
                    id: s.id,
                    x: Number(s.mesh.position.x.toFixed(2)),
                    z: Number(s.mesh.position.z.toFixed(2)),
                    isLeader: s.isLeader
                }));

                gameState.armies[type] = {
                    soldiers: soldiersData,
                    isInvincible: army.isInvincible,
                    speedMultiplier: army.speedMultiplier
                };
            });

            this.broadcast(gameState);
        }, 1000 / GAME_CONFIG.SYNC_RATE);
    }

    handleGameStateSync(data) {
        if (this.isHost) return;
        const game = this.app.game;
        if (!game || game.state !== 'playing') return;

        Object.entries(data.armies).forEach(([type, armyData]) => {
            const army = game.armies.get(type);
            if (!army) return;

            armyData.soldiers.forEach(serverSoldier => {
                const soldier = army.soldiers.find(s => s.id === serverSoldier.id);
                if (soldier) {
                    const lerpSpeed = 0.5;
                    soldier.mesh.position.x += (serverSoldier.x - soldier.mesh.position.x) * lerpSpeed;
                    soldier.mesh.position.z += (serverSoldier.z - soldier.mesh.position.z) * lerpSpeed;
                }
            });

            army.isInvincible = armyData.isInvincible;
            army.speedMultiplier = armyData.speedMultiplier;
        });
    }

    handleRemoteConversion(data) {
        const game = this.app.game;
        if (!game) return;

        const fromArmy = game.armies.get(data.fromType);
        const toArmy = game.armies.get(data.toType);

        if (fromArmy && toArmy) {
            const soldier = fromArmy.soldiers.find(s => s.id === data.soldierId);
            if (soldier && !soldier.isConverting) {
                game.convertSoldier(soldier, fromArmy, toArmy);
            }
        }
    }

    getNextAvailableType() {
        const types = [SOLDIER_TYPES.PAPER, SOLDIER_TYPES.SCISSORS];
        for (const type of types) {
            if (!this.players.has(type)) return type;
        }
        return null;
    }

    getPlayersArray() {
        return Array.from(this.players.entries()).map(([type, data]) => ({
            type,
            id: data.id,
            username: data.username,
            connected: data.connected
        }));
    }

    syncPlayersFromArray(arr) {
        this.players.clear();
        arr.forEach(p => {
            this.players.set(p.type, {
                id: p.id,
                username: p.username,
                connected: p.connected
            });
        });
    }

    updatePlayerList() {
        const playerArray = Array.from(this.players.entries()).map(([type, data]) => ({
            type,
            connected: data.connected,
            name: data.id === IdentityService.currentUser.id ? 'You' : (data.username || 'Friend')
        }));
        this.app.ui.updatePlayerSlots(playerArray);
    }

    sendConversion(soldierId, fromType, toType) {
        this.broadcast({ type: 'conversion', soldierId, fromType, toType });
    }

    leaveParty() {
        this.broadcast({ type: 'player_left' });
        if (this.syncInterval) clearInterval(this.syncInterval);
        RealtimeService.leave();
        this.players.clear();
        this.remoteInputs.clear();
        this.isHost = false;
        this.partyId = null;
    }

    handleHostDisconnect() {
        alert('Host disconnected! Returning to menu.');
        this.leaveParty();
        this.app.game.reset();
    }

    handlePeerDisconnect(playerId) {
        console.log('Player disconnected:', playerId);
        for (const [type, data] of this.players) {
            if (data.id === playerId) {
                data.connected = false;
                this.updatePlayerList();
                break;
            }
        }
    }

    generatePartyId() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    // Compatibility methods
    getPlayerInput(type) {
        return this.remoteInputs.get(type) || { x: 0, z: 0 };
    }

    handleGameStart(data) {
        this.app.game.startMatch();
    }
}
