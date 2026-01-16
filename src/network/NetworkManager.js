// NetworkManager - PeerJS-based multiplayer with real-time sync
import { SOLDIER_TYPES, GAME_CONFIG } from '../utils/constants.js';

export class NetworkManager {
    constructor(app) {
        this.app = app;
        this.peer = null;
        this.connections = new Map();
        this.isHost = false;
        this.partyId = null;
        this.localPlayerType = null;
        this.syncInterval = null;

        // Player data
        this.players = new Map();

        // Real-time state sync
        this.remoteInputs = new Map();

        this.initPeer();
    }

    initPeer() {
        this.loadPeerJS().then(() => {
            console.log('📡 PeerJS ready');
        });
    }

    async loadPeerJS() {
        return new Promise((resolve) => {
            if (window.Peer) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://unpkg.com/peerjs@1.4.7/dist/peerjs.min.js';
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }

    createParty() {
        this.partyId = this.generatePartyId();
        this.isHost = true;
        this.localPlayerType = SOLDIER_TYPES.ROCK;

        // Initialize Peer for Host
        this.peer = new Peer(this.partyId, {
            debug: 2,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });

        this.peer.on('open', (id) => {
            console.log('🎉 Party created:', id);

            this.players.set(this.localPlayerType, {
                peerId: id,
                connected: true
            });

            this.app.ui.showLobby(id, this.localPlayerType);
            this.updatePlayerList();

            // Start broadcasting game state as host
            this.startHostSync();
        });

        this.peer.on('connection', (conn) => {
            this.handleIncomingConnection(conn);
        });

        this.peer.on('error', (err) => {
            console.error('Peer error:', err);
            if (err.type === 'unavailable-id') {
                this.partyId = this.generatePartyId();
                if (this.peer) this.peer.destroy();
                this.createParty();
            } else {
                alert(`Host Creation Error: ${err.type}`);
            }
        });
    }

    joinParty(partyId) {
        this.partyId = partyId.toUpperCase();
        this.isHost = false;

        // 1. REUSE existing Peer if active (Don't destroy! User Request)
        if (this.peer && !this.peer.destroyed) {
            console.log('♻️ Reusing existing Peer:', this.peer.id);
            this.connectToHost();
            return;
        }

        // 2. Initialize new Peer only if strictly necessary
        console.log('🆕 Initializing new Peer...');
        // CONFIG: Google STUN (Standard)
        this.peer = new Peer(null, {
            debug: 2,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });

        // 3. Setup Connection Timeout (3m)
        this.connectionTimer = setTimeout(() => {
            console.error('❌ Connection timed out');
            alert('Connection timed out! Try refreshing the page.');
            this.app.ui.hideJoinModal();
        }, 180000);

        this.peer.on('open', (localId) => {
            console.log('📡 Peer Open. ID:', localId);
            this.connectToHost();
        });

        this.peer.on('error', (err) => {
            console.error('Peer error:', err);
            if (err.type === 'peer-unavailable') {
                alert('Party ID not found. Host might be offline.');
                this.app.ui.hideJoinModal();
            }
        });
    }

    connectToHost() {
        if (!this.peer || this.peer.destroyed) return;

        console.log('📡 Dialing Host:', this.partyId);

        // Reliable: true (TCP) - User confirmed this "worked slowly" before
        const conn = this.peer.connect(this.partyId, { reliable: true });

        conn.on('open', () => {
            if (this.connectionTimer) clearTimeout(this.connectionTimer);
            console.log('✅ Channel OPEN!');
            this.connections.set(this.partyId, conn);

            conn.send({
                type: 'join_request',
                peerId: this.peer.id
            });
        });

        conn.peerConnection.oniceconnectionstatechange = () => {
            const state = conn.peerConnection.iceConnectionState;
            console.log(`🧊 ICE State: ${state}`);

            if (state === 'disconnected') {
                console.warn('⚠️ ICE Disconnected. Waiting for recovery...');
                // Do NOT close/hard reset immediately. ICE can sometimes recover.
                // PeerJS naturally handles some retries.
            }
        };

        conn.on('data', (data) => this.handleMessage(conn, data));

        conn.on('close', () => {
            console.log('❌ Connection closed');
            if (this.connections.has(this.partyId)) {
                this.handleHostDisconnect();
            }
        });

        conn.on('error', (err) => console.error('Conn error:', err));
    }

    handleIncomingConnection(conn) {
        console.log('📨 Incoming connection:', conn.peer);

        conn.on('open', () => {
            this.connections.set(conn.peer, conn);
        });

        conn.on('data', (data) => this.handleMessage(conn, data));

        conn.on('close', () => {
            this.handlePeerDisconnect(conn.peer);
        });
    }

    handleMessage(conn, data) {
        switch (data.type) {
            case 'join_request':
                if (this.isHost) {
                    const assignedType = this.getNextAvailableType();
                    if (assignedType) {
                        this.players.set(assignedType, {
                            peerId: data.peerId,
                            connected: true
                        });

                        conn.send({
                            type: 'player_assigned',
                            playerType: assignedType,
                            players: this.getPlayersArray()
                        });

                        this.broadcast({
                            type: 'player_joined',
                            playerType: assignedType,
                            players: this.getPlayersArray()
                        }, conn.peer);

                        this.updatePlayerList();
                    } else {
                        conn.send({ type: 'party_full' });
                    }
                }
                break;

            case 'player_assigned':
                this.localPlayerType = data.playerType;
                this.syncPlayersFromArray(data.players);
                this.app.ui.showLobby(this.partyId, this.localPlayerType);
                this.app.ui.hideJoinModal();
                this.updatePlayerList();
                break;

            case 'player_joined':
                this.syncPlayersFromArray(data.players);
                this.updatePlayerList();
                break;

            case 'party_full':
                alert('Party is full!');
                this.leaveParty();
                break;

            case 'game_start':
                this.handleGameStart(data);
                break;

            // CLIENT INPUT -> HOST
            case 'player_input':
                if (this.isHost) {
                    this.remoteInputs.set(data.playerType, { x: data.x, z: data.z });
                }
                break;

            // HOST STATE -> CLIENT
            case 'game_state':
                this.handleGameStateSync(data);
                break;

            case 'conversion':
                this.handleRemoteConversion(data);
                break;

            case 'game_over':
                this.app.game.endGame(data.winner);
                break;

            case 'rematch_request':
                if (this.isHost) {
                    // Start rematch logic
                }
                break;
        }
    }

    // Host broadcasts full game state periodically
    startHostSync() {
        if (!this.isHost) return;
        if (this.syncInterval) clearInterval(this.syncInterval);

        this.syncInterval = setInterval(() => {
            if (this.app.game.state !== 'playing') return;

            // Collect all soldier positions
            const gameState = {
                type: 'game_state',
                armies: {}
            };

            this.app.game.armies.forEach((army, type) => {
                const soldiersData = army.soldiers.map(s => ({
                    id: s.id,
                    x: Number(s.mesh.position.x.toFixed(2)), // Optimize payload
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

    // Client receives game state from host
    handleGameStateSync(data) {
        if (this.isHost) return; // Host is authority

        const game = this.app.game;
        if (!game || game.state !== 'playing') return;

        // Sync all armies (Sticky Sync)
        Object.entries(data.armies).forEach(([type, armyData]) => {
            const army = game.armies.get(type);
            if (!army) return;

            armyData.soldiers.forEach(serverSoldier => {
                const soldier = army.soldiers.find(s => s.id === serverSoldier.id);
                if (soldier) {
                    // Strong interpolation
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
            if (!this.players.has(type)) {
                return type;
            }
        }
        return null;
    }

    getPlayersArray() {
        return Array.from(this.players.entries()).map(([type, data]) => ({
            type,
            peerId: data.peerId,
            connected: data.connected
        }));
    }

    syncPlayersFromArray(arr) {
        this.players.clear();
        arr.forEach(p => {
            this.players.set(p.type, {
                peerId: p.peerId,
                connected: p.connected
            });
        });
    }

    updatePlayerList() {
        const playerArray = Array.from(this.players.entries()).map(([type, data]) => ({
            type,
            connected: data.connected,
            name: type === this.localPlayerType ? 'You' : 'Player'
        }));
        this.app.ui.updatePlayerSlots(playerArray);
    }

    broadcast(data, excludePeerId = null) {
        this.connections.forEach((conn, peerId) => {
            if (peerId !== excludePeerId && conn.open) {
                try {
                    conn.send(data);
                } catch (e) {
                    console.warn('Failed to send to', peerId);
                }
            }
        });
    }

    sendInput(input) {
        const data = {
            type: 'player_input',
            playerType: this.localPlayerType,
            x: input.x,
            z: input.z
        };
        // Host directly consumes input, clients send it
        if (this.isHost) {
            // Host logic handles its own input directly in Game.js
        } else {
            this.broadcast(data); // Send to host
        }
    }

    getPlayerInput(type) {
        return this.remoteInputs.get(type) || { x: 0, z: 0 };
    }

    sendConversion(soldierId, fromType, toType) {
        this.broadcast({
            type: 'conversion',
            soldierId,
            fromType,
            toType
        });
    }

    leaveParty() {
        this.broadcast({ type: 'player_left', playerType: this.localPlayerType });

        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }

        this.connections.forEach(conn => conn.close());
        this.connections.clear();

        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }

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

    handlePeerDisconnect(peerId) {
        console.log('Player disconnected:', peerId);
        for (const [type, data] of this.players) {
            if (data.peerId === peerId) {
                data.connected = false;
                this.updatePlayerList();
                break;
            }
        }
    }

    generatePartyId() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let id = '';
        for (let i = 6; i--;) { // slightly optimized loop for random id
            id += chars[Math.floor(Math.random() * chars.length)];
        }
        return id;
    }
}
