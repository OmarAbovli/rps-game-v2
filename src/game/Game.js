// Game Manager - Controls game state and flow
import * as THREE from 'three';
import { Arena } from './Arena.js';
import { Army } from './Army.js';
import { PowerUpManager } from './PowerUpManager.js';
import { SOLDIER_TYPES, GAME_STATES, GAME_CONFIG } from '../utils/constants.js';

export class Game {
    constructor(app) {
        this.app = app;
        this.scene = app.scene;
        this.camera = app.camera;
        this.renderer = app.renderer;

        // Game state
        this.state = GAME_STATES.MENU;
        this.localPlayerType = null;
        this.armies = new Map();
        this.arena = null;
        this.powerUpManager = null;

        // Solo test mode
        this.isSoloTest = false;
        this.aiUpdateTimers = new Map();

        // Placement phase
        this.placementTimer = GAME_CONFIG.PLACEMENT_TIME;
        this.isReady = false;

        // Drag and drop
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.draggedSoldier = null;
        this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

        // Input
        this.keys = {
            w: false, a: false, s: false, d: false,
            arrowup: false, arrowleft: false, arrowdown: false, arrowright: false
        };

        this.setupInput();
    }

    setupInput() {
        // Keyboard input
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (key in this.keys) {
                this.keys[key] = true;
            }
        });

        window.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            if (key in this.keys) {
                this.keys[key] = false;
            }
        });

        // Mouse input for drag-and-drop
        this.renderer.domElement.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.renderer.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.renderer.domElement.addEventListener('mouseup', (e) => this.onMouseUp(e));

        // Touch support
        this.renderer.domElement.addEventListener('touchstart', (e) => this.onTouchStart(e));
        this.renderer.domElement.addEventListener('touchmove', (e) => this.onTouchMove(e));
        this.renderer.domElement.addEventListener('touchend', (e) => this.onTouchEnd(e));
    }

    // Mouse handling for drag-and-drop
    updateMouse(e) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    onMouseDown(e) {
        if (this.state !== GAME_STATES.PLACEMENT) return;

        this.updateMouse(e);
        this.raycaster.setFromCamera(this.mouse, this.camera);

        // Find clicked soldier from local army
        const localArmy = this.armies.get(this.localPlayerType);
        if (!localArmy) return;

        const soldierMeshes = localArmy.soldiers.map(s => s.mesh);
        const intersects = this.raycaster.intersectObjects(soldierMeshes, true);

        if (intersects.length > 0) {
            // Find the soldier from the intersected mesh
            let obj = intersects[0].object;
            while (obj.parent && !obj.userData.soldier) {
                obj = obj.parent;
            }
            if (obj.userData.soldier) {
                this.draggedSoldier = obj.userData.soldier;
                this.draggedSoldier.isDragging = true;
            }
        }
    }

    onMouseMove(e) {
        if (!this.draggedSoldier || this.state !== GAME_STATES.PLACEMENT) return;

        this.updateMouse(e);
        this.raycaster.setFromCamera(this.mouse, this.camera);

        // Get intersection with ground plane
        const intersection = new THREE.Vector3();
        this.raycaster.ray.intersectPlane(this.dragPlane, intersection);

        if (intersection) {
            // Check if position is within spawn zone
            const zone = this.arena.getSpawnZone(this.localPlayerType);
            const halfW = zone.width / 2;
            const halfH = zone.height / 2;

            // Clamp to spawn zone
            const x = Math.max(zone.x - halfW + 1, Math.min(zone.x + halfW - 1, intersection.x));
            const z = Math.max(zone.z - halfH + 1, Math.min(zone.z + halfH - 1, intersection.z));

            // Don't allow in neutral zone
            if (!this.arena.isInNeutralZone(x, z)) {
                this.draggedSoldier.mesh.position.x = x;
                this.draggedSoldier.mesh.position.z = z;
            }
        }
    }

    onMouseUp(e) {
        if (this.draggedSoldier) {
            this.draggedSoldier.isDragging = false;
            this.draggedSoldier = null;
        }
    }

    // Touch handling
    onTouchStart(e) {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            this.onMouseDown({ clientX: touch.clientX, clientY: touch.clientY });
        }
    }

    onTouchMove(e) {
        if (e.touches.length === 1) {
            e.preventDefault();
            const touch = e.touches[0];
            this.onMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
        }
    }

    onTouchEnd(e) {
        this.onMouseUp(e);
    }

    // Start solo test mode
    startSoloTest() {
        console.log('🎮 Starting Solo Test Mode');
        this.isSoloTest = true;
        this.localPlayerType = SOLDIER_TYPES.ROCK;
        this.startGame(this.localPlayerType);
    }

    // Initialize a new game
    startGame(playerType) {
        console.log('🎮 Starting game as:', playerType);

        this.localPlayerType = playerType;
        this.state = GAME_STATES.PLACEMENT;
        this.placementTimer = GAME_CONFIG.PLACEMENT_TIME;
        this.isReady = false;

        // Reset keys
        this.keys = { w: false, a: false, s: false, d: false };

        // Clear previous game
        this.cleanup();

        // Create arena
        this.arena = new Arena(this.scene);

        // Create armies
        Object.values(SOLDIER_TYPES).forEach(type => {
            const isLocal = type === playerType;
            const army = new Army(this.scene, type, isLocal, this.arena);
            this.armies.set(type, army);

            const spawnZone = this.arena.getSpawnZone(type);
            army.setSpawnPosition(spawnZone.x, spawnZone.z);
        });

        // Power-up manager
        this.powerUpManager = new PowerUpManager(this.scene, this);

        // Update UI
        this.app.ui.showPlacementUI();
    }

    startBattle() {
        console.log('⚔️ Battle begins!');
        this.state = GAME_STATES.PLAYING;
        this.app.ui.showGameHUD();
        this.powerUpManager.startSpawning();
        this.app.audio.playClick();
    }

    update(delta) {
        if (this.state === GAME_STATES.PLACEMENT) {
            this.updatePlacement(delta);
        } else if (this.state === GAME_STATES.PLAYING) {
            this.updateGame(delta);
        }
    }

    updatePlacement(delta) {
        this.placementTimer -= delta;
        this.app.ui.updatePlacementTimer(Math.ceil(this.placementTimer));

        if (Math.ceil(this.placementTimer) <= 3 && Math.ceil(this.placementTimer + delta) > Math.ceil(this.placementTimer)) {
            this.app.audio.playCountdown(this.placementTimer <= 1);
        }

        if (this.placementTimer <= 0) {
            this.startBattle();
        }

        // Update soldier animations during placement
        this.armies.forEach(army => army.updatePlacement(delta));
    }

    updateGame(delta) {
        // HOST Logic (or Solo)
        if (this.isHostOrSolo()) {
            this.updateHost(delta);
        } else {
            // CLIENT Logic
            this.updateClient(delta);
        }
    }

    isHostOrSolo() {
        return this.isSoloTest || !this.app.network || this.app.network.isHost;
    }

    updateHost(delta) {
        // 1. Process Local Input
        const localArmy = this.armies.get(this.localPlayerType);
        const isEliminated = !localArmy || localArmy.soldiers.length === 0;

        const movement = { x: 0, z: 0 };
        if (!isEliminated) {
            if (this.keys.w || this.keys.arrowup) movement.z -= 1;
            if (this.keys.s || this.keys.arrowdown) movement.z += 1;
            if (this.keys.a || this.keys.arrowleft) movement.x -= 1;
            if (this.keys.d || this.keys.arrowright) movement.x += 1;

            if (movement.x !== 0 && movement.z !== 0) {
                const length = Math.sqrt(movement.x * movement.x + movement.z * movement.z);
                movement.x /= length;
                movement.z /= length;
            }
        }

        // 2. Update All Armies (Logic & Physics)
        this.armies.forEach((army, type) => {
            const isLocalArmy = type === this.localPlayerType;
            let input;

            if (isLocalArmy && !isEliminated) {
                input = movement;
            } else if (this.isSoloTest) {
                input = this.getAIInput(type);
            } else {
                // Get remote input from NetworkManager
                input = this.app.network.getPlayerInput(type);
            }

            army.update(delta, input, this.arena);
        });

        // 3. Run Systems (Collisions, PowerUps, AI checks, Win Cond)
        this.checkArmyCollisions();
        this.powerUpManager.update(delta);
        this.updateSoldierCounts();
        this.checkWinCondition();
    }

    updateClient(delta) {
        // CLIENT only sends input and visual updates

        // 1. Send Local Input
        const localArmy = this.armies.get(this.localPlayerType);
        const isEliminated = !localArmy || localArmy.soldiers.length === 0;

        const movement = { x: 0, z: 0 };
        if (!isEliminated) {
            if (this.keys.w || this.keys.arrowup) movement.z -= 1;
            if (this.keys.s || this.keys.arrowdown) movement.z += 1;
            if (this.keys.a || this.keys.arrowleft) movement.x -= 1;
            if (this.keys.d || this.keys.arrowright) movement.x += 1;

            // Normalize
            if (movement.x !== 0 && movement.z !== 0) {
                const length = Math.sqrt(movement.x * movement.x + movement.z * movement.z);
                movement.x /= length;
                movement.z /= length;
            }

            // Send to Host (Throttled)
            const now = Date.now();
            if (!this.lastInputTime || now - this.lastInputTime > 50) { // Send ~20 times/sec
                this.app.network.sendInput(movement);
                this.lastInputTime = now;
            }
        }

        // 2. Visual Update Only (positions updated via NetworkManager sync)
        // We still call update() to run animations (bobbing) but pass 0 input/no arena
        // so physics doesn't override server positions
        this.armies.forEach(army => {
            // Only update visuals (animation)
            army.soldiers.forEach(s => s.update(delta));
        });

        // 3. UI Updates
        this.updateSoldierCounts();
    }

    getAIInput(type) {
        const army = this.armies.get(type);
        if (!army || !army.leader) return { x: 0, z: 0 };

        const leaderPos = army.leader.getPosition();

        // PRIORITY 1: Check for danger - armies that beat us
        let dangerPos = null;
        let dangerDistance = Infinity;

        this.armies.forEach((targetArmy, targetType) => {
            if (targetType === type || targetArmy.soldiers.length === 0) return;

            const winner = this.getRPSWinner(type, targetType);
            if (winner === targetType) {
                // This army beats us - RUN!
                targetArmy.soldiers.forEach(soldier => {
                    const dist = leaderPos.distanceTo(soldier.mesh.position);
                    if (dist < 10 && dist < dangerDistance) {
                        dangerDistance = dist;
                        dangerPos = soldier.mesh.position.clone();
                    }
                });
            }
        });

        // If danger is close, RUN AWAY (highest priority)
        if (dangerPos && dangerDistance < 8) {
            const dx = leaderPos.x - dangerPos.x;
            const dz = leaderPos.z - dangerPos.z;
            const len = Math.sqrt(dx * dx + dz * dz) || 1;
            return { x: dx / len, z: dz / len };
        }

        // PRIORITY 2: Chase weaker enemies
        let preyPos = null;
        let preyDistance = Infinity;

        this.armies.forEach((targetArmy, targetType) => {
            if (targetType === type || targetArmy.soldiers.length === 0) return;

            const winner = this.getRPSWinner(type, targetType);
            if (winner === type) {
                // We beat this army - CHASE!
                targetArmy.soldiers.forEach(soldier => {
                    const dist = leaderPos.distanceTo(soldier.mesh.position);
                    if (dist < preyDistance) {
                        preyDistance = dist;
                        preyPos = soldier.mesh.position.clone();
                    }
                });
            }
        });

        // Chase prey
        if (preyPos) {
            const dx = preyPos.x - leaderPos.x;
            const dz = preyPos.z - leaderPos.z;
            const len = Math.sqrt(dx * dx + dz * dz) || 1;
            return { x: dx / len, z: dz / len };
        }

        // PRIORITY 3: Wander randomly if no action needed
        if (!this.aiUpdateTimers.has(type) || Date.now() - this.aiUpdateTimers.get(type) > 2000) {
            this.aiUpdateTimers.set(type, Date.now());
            army.aiWanderDir = {
                x: (Math.random() - 0.5) * 2,
                z: (Math.random() - 0.5) * 2
            };
        }
        return army.aiWanderDir || { x: 0, z: 0 };
    }

    checkArmyCollisions() {
        const armyArray = Array.from(this.armies.values());

        for (let i = 0; i < armyArray.length; i++) {
            for (let j = i + 1; j < armyArray.length; j++) {
                const army1 = armyArray[i];
                const army2 = armyArray[j];

                const soldiers1 = [...army1.soldiers];
                const soldiers2 = [...army2.soldiers];

                for (const soldier1 of soldiers1) {
                    if (soldier1.isConverting) continue;

                    for (const soldier2 of soldiers2) {
                        if (soldier2.isConverting) continue;

                        const distance = soldier1.mesh.position.distanceTo(soldier2.mesh.position);
                        const collisionDist = GAME_CONFIG.SOLDIER_COLLISION_RADIUS * 2;

                        if (distance < collisionDist) {
                            this.handleCollision(soldier1, soldier2, army1, army2);
                        }
                    }
                }
            }
        }
    }

    handleCollision(soldier1, soldier2, army1, army2) {
        if (army1.isInvincible || army2.isInvincible) return;

        const type1 = army1.type;
        const type2 = army2.type;
        const winner = this.getRPSWinner(type1, type2);

        if (winner === type1) {
            this.convertSoldier(soldier2, army2, army1);
        } else if (winner === type2) {
            this.convertSoldier(soldier1, army1, army2);
        }
    }

    getRPSWinner(type1, type2) {
        if (type1 === type2) return null;

        if (type1 === SOLDIER_TYPES.ROCK && type2 === SOLDIER_TYPES.SCISSORS) return type1;
        if (type2 === SOLDIER_TYPES.ROCK && type1 === SOLDIER_TYPES.SCISSORS) return type2;

        if (type1 === SOLDIER_TYPES.SCISSORS && type2 === SOLDIER_TYPES.PAPER) return type1;
        if (type2 === SOLDIER_TYPES.SCISSORS && type1 === SOLDIER_TYPES.PAPER) return type2;

        if (type1 === SOLDIER_TYPES.PAPER && type2 === SOLDIER_TYPES.ROCK) return type1;
        if (type2 === SOLDIER_TYPES.PAPER && type1 === SOLDIER_TYPES.ROCK) return type2;

        return null;
    }

    convertSoldier(soldier, fromArmy, toArmy) {
        soldier.isConverting = true;
        this.app.audio.playConvert();

        soldier.playConversionEffect(() => {
            fromArmy.removeSoldier(soldier);
            toArmy.addSoldier(soldier);
            soldier.changeType(toArmy.type);
            soldier.isConverting = false;

            if (!this.isSoloTest) {
                this.app.network.sendConversion(soldier.id, fromArmy.type, toArmy.type);
            }
        });
    }

    updateSoldierCounts() {
        const counts = {};
        this.armies.forEach((army, type) => {
            counts[type] = army.soldiers.length;
        });
        this.app.ui.updateSoldierCounts(counts);
    }

    checkWinCondition() {
        const activeArmies = Array.from(this.armies.entries()).filter(
            ([type, army]) => army.soldiers.length > 0
        );

        if (activeArmies.length === 1) {
            this.endGame(activeArmies[0][0]);
        }
    }

    endGame(winnerType) {
        console.log('🏆 Winner:', winnerType);
        this.state = GAME_STATES.ENDED;
        this.powerUpManager.stopSpawning();

        const winnerArmy = this.armies.get(winnerType);
        this.app.ui.showGameOver(winnerType, winnerArmy.soldiers.length);
        this.app.audio.playVictory();
    }

    cleanup() {
        this.armies.forEach(army => army.destroy());
        this.armies.clear();

        if (this.arena) {
            this.arena.destroy();
            this.arena = null;
        }

        if (this.powerUpManager) {
            this.powerUpManager.destroy();
            this.powerUpManager = null;
        }
    }

    reset() {
        this.cleanup();
        this.state = GAME_STATES.MENU;
        this.localPlayerType = null;
        this.isSoloTest = false;
        this.keys = { w: false, a: false, s: false, d: false };
        this.app.ui.showMainMenu();
    }
}
