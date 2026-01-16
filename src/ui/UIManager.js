// UIManager - Handles all UI screens and HUD
import { GAME_STATES, TYPE_ICONS, SOLDIER_TYPES } from '../utils/constants.js';

export class UIManager {
    constructor(app) {
        this.app = app;

        // Cache DOM elements
        this.screens = {
            mainMenu: document.getElementById('main-menu'),
            joinModal: document.getElementById('join-modal'),
            lobby: document.getElementById('lobby-screen'),
            placementUI: document.getElementById('placement-ui'),
            gameHUD: document.getElementById('game-hud'),
            gameOver: document.getElementById('game-over')
        };

        this.elements = {
            // Main menu
            btnCreateParty: document.getElementById('btn-create-party'),
            btnJoinParty: document.getElementById('btn-join-party'),
            btnSoloTest: document.getElementById('btn-solo-test'),

            // Join modal
            partyIdInput: document.getElementById('party-id-input'),
            btnJoinConfirm: document.getElementById('btn-join-confirm'),
            btnJoinCancel: document.getElementById('btn-join-cancel'),

            // Lobby
            lobbyPartyId: document.getElementById('lobby-party-id'),
            btnCopyId: document.getElementById('btn-copy-id'),
            btnStartGame: document.getElementById('btn-start-game'),
            playerSlots: [
                document.getElementById('player-1'),
                document.getElementById('player-2'),
                document.getElementById('player-3')
            ],

            // Placement
            placementCountdown: document.getElementById('placement-countdown'),
            btnReady: document.getElementById('btn-ready'),

            // HUD
            counterRock: document.getElementById('counter-rock'),
            counterPaper: document.getElementById('counter-paper'),
            counterScissors: document.getElementById('counter-scissors'),
            powerupActive: document.getElementById('powerup-active'),

            // Game over
            winnerText: document.getElementById('winner-text'),
            finalCount: document.getElementById('final-count'),
            btnPlayAgain: document.getElementById('btn-play-again'),
            btnBackMenu: document.getElementById('btn-back-menu')
        };

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Main menu
        this.elements.btnCreateParty?.addEventListener('click', () => {
            this.app.audio.playClick();
            this.app.network.createParty();
        });

        this.elements.btnJoinParty?.addEventListener('click', () => {
            this.app.audio.playClick();
            this.showJoinModal();
        });

        // Solo test mode
        this.elements.btnSoloTest?.addEventListener('click', () => {
            this.app.audio.playClick();
            this.app.startSoloTest();
        });

        // Join modal
        this.elements.btnJoinConfirm?.addEventListener('click', () => {
            const partyId = this.elements.partyIdInput.value.trim().toUpperCase();
            if (partyId.length >= 4) {
                this.app.audio.playClick();
                this.app.network.joinParty(partyId);
            } else {
                this.app.audio.playError();
            }
        });

        this.elements.btnJoinCancel?.addEventListener('click', () => {
            this.app.audio.playClick();
            this.hideJoinModal();
        });

        // Lobby
        this.elements.btnCopyId?.addEventListener('click', () => {
            const partyId = this.elements.lobbyPartyId.textContent;
            navigator.clipboard.writeText(partyId);
            this.elements.btnCopyId.textContent = '✓';
            this.app.audio.playClick();
            setTimeout(() => {
                this.elements.btnCopyId.textContent = '📋';
            }, 1000);
        });

        this.elements.btnStartGame?.addEventListener('click', () => {
            this.app.audio.playClick();
            this.app.network.startGame();
        });

        // Placement
        this.elements.btnReady?.addEventListener('click', () => {
            this.app.audio.playClick();
            this.app.network.sendReady();
            this.elements.btnReady.disabled = true;
            this.elements.btnReady.textContent = '✓ Ready!';
        });

        // Game over
        this.elements.btnPlayAgain?.addEventListener('click', () => {
            this.app.audio.playClick();
            if (this.app.game.isSoloTest) {
                this.app.startSoloTest();
            } else {
                this.app.network.requestRematch();
            }
        });

        this.elements.btnBackMenu?.addEventListener('click', () => {
            this.app.audio.playClick();
            this.app.network.leaveParty();
            this.app.game.reset();
        });

        // Keyboard shortcuts
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (!this.screens.joinModal.classList.contains('hidden')) {
                    this.hideJoinModal();
                }
            }
        });
    }

    // Screen visibility
    hideAllScreens() {
        Object.values(this.screens).forEach(screen => {
            if (screen) screen.classList.add('hidden');
        });
    }

    showMainMenu() {
        this.hideAllScreens();
        this.screens.mainMenu?.classList.remove('hidden');
    }

    showJoinModal() {
        this.screens.joinModal?.classList.remove('hidden');
        if (this.elements.partyIdInput) {
            this.elements.partyIdInput.value = '';
            this.elements.partyIdInput.focus();
        }
    }

    hideJoinModal() {
        this.screens.joinModal?.classList.add('hidden');
    }

    showLobby(partyId, playerType) {
        this.hideAllScreens();
        this.screens.lobby?.classList.remove('hidden');
        if (this.elements.lobbyPartyId) {
            this.elements.lobbyPartyId.textContent = partyId;
        }

        // Highlight the local player's slot
        this.updatePlayerSlots([{ type: playerType, connected: true }]);
    }

    updatePlayerSlots(players) {
        const types = [SOLDIER_TYPES.ROCK, SOLDIER_TYPES.PAPER, SOLDIER_TYPES.SCISSORS];

        types.forEach((type, index) => {
            const slot = this.elements.playerSlots[index];
            if (!slot) return;

            const player = players.find(p => p.type === type);

            if (player && player.connected) {
                slot.classList.add('connected');
                slot.querySelector('.player-name').textContent = player.name || `Player ${index + 1}`;
            } else {
                slot.classList.remove('connected');
                slot.querySelector('.player-name').textContent = 'Waiting...';
            }
        });

        // Enable start button when all players connected
        const connectedCount = players.filter(p => p.connected).length;
        if (this.elements.btnStartGame) {
            this.elements.btnStartGame.disabled = connectedCount < 3;
            this.elements.btnStartGame.textContent = `▶️ Start Game (${connectedCount}/3 Players)`;
        }
    }

    showPlacementUI() {
        this.hideAllScreens();
        this.screens.placementUI?.classList.remove('hidden');
        if (this.elements.btnReady) {
            this.elements.btnReady.disabled = false;
            this.elements.btnReady.textContent = '✓ Ready';
        }
    }

    updatePlacementTimer(seconds) {
        if (!this.elements.placementCountdown) return;

        this.elements.placementCountdown.textContent = seconds;

        // Flash when low
        if (seconds <= 3) {
            this.elements.placementCountdown.style.color = '#ff6b6b';
            this.elements.placementCountdown.style.animation = 'none';
            setTimeout(() => {
                if (this.elements.placementCountdown) {
                    this.elements.placementCountdown.style.animation = 'titleBounce 0.3s ease';
                }
            }, 10);
        }
    }

    showGameHUD() {
        this.screens.placementUI?.classList.add('hidden');
        this.screens.gameHUD?.classList.remove('hidden');
    }

    updateSoldierCounts(counts) {
        Object.entries(counts).forEach(([type, count]) => {
            const key = `counter${type.charAt(0).toUpperCase() + type.slice(1)}`;
            const counterEl = this.elements[key];
            if (counterEl) {
                const valueEl = counterEl.querySelector('.counter-value');
                if (valueEl) {
                    const oldValue = parseInt(valueEl.textContent);
                    valueEl.textContent = count;

                    // Highlight when count changes
                    if (oldValue !== count) {
                        counterEl.style.transform = 'scale(1.2)';
                        setTimeout(() => {
                            counterEl.style.transform = 'scale(1)';
                        }, 150);
                    }
                }
            }
        });
    }

    showPowerUpActive(icon, duration) {
        const indicator = this.elements.powerupActive;
        if (!indicator) return;

        indicator.classList.remove('hidden');
        const iconEl = indicator.querySelector('.powerup-icon');
        const timerEl = indicator.querySelector('.powerup-timer');

        if (iconEl) iconEl.textContent = icon;

        if (duration > 0 && timerEl) {
            let remaining = duration;
            timerEl.textContent = `${remaining}s`;

            const interval = setInterval(() => {
                remaining -= 1;
                if (remaining <= 0) {
                    clearInterval(interval);
                    indicator.classList.add('hidden');
                } else {
                    timerEl.textContent = `${remaining}s`;
                }
            }, 1000);
        } else {
            // Instant effect
            setTimeout(() => {
                indicator.classList.add('hidden');
            }, 1000);
        }
    }

    showGameOver(winnerType, soldierCount) {
        this.screens.gameHUD?.classList.add('hidden');
        this.screens.gameOver?.classList.remove('hidden');

        const icon = TYPE_ICONS[winnerType];
        const name = winnerType.toUpperCase();
        if (this.elements.winnerText) {
            this.elements.winnerText.textContent = `🏆 ${icon} ${name} WINS! 🏆`;
        }
        if (this.elements.finalCount) {
            this.elements.finalCount.textContent = soldierCount;
        }
    }
}
