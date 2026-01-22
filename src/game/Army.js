// Army - Group of soldiers with leader and following mechanics
import * as THREE from 'three';
import { Soldier } from './Soldier.js';
import { GAME_CONFIG, SOLDIER_TYPES, COLORS } from '../utils/constants.js';

export class Army {
    constructor(scene, type, isLocal, arena) {
        this.scene = scene;
        this.type = type;
        this.isLocal = isLocal;
        this.arena = arena;

        this.soldiers = [];
        this.leader = null;

        // Power-up states
        this.isInvincible = false;
        this.speedMultiplier = 1;
        this.isReversed = false;
        this.magnetActive = false;

        // Lost soldiers tracker
        this.maxSoldiers = GAME_CONFIG.SOLDIERS_PER_ARMY;

        // AI wander direction
        this.aiWanderDir = { x: 0, z: 0 };

        this.createSoldiers();
    }

    createSoldiers() {
        // Create leader first
        this.leader = new Soldier(this.scene, this.type, true);
        this.soldiers.push(this.leader);

        // Create regular soldiers
        for (let i = 1; i < GAME_CONFIG.SOLDIERS_PER_ARMY; i++) {
            const soldier = new Soldier(this.scene, this.type, false);
            this.soldiers.push(soldier);
        }
    }

    setSpawnPosition(centerX, centerZ) {
        const spacing = GAME_CONFIG.FOLLOW_DISTANCE * 1.8;

        // Leader at center
        this.leader.setPosition(centerX, GAME_CONFIG.SOLDIER_SIZE, centerZ);

        // Others in formation
        const others = this.soldiers.filter(s => !s.isLeader);
        const angleStep = (Math.PI * 2) / Math.max(others.length, 1);

        others.forEach((soldier, i) => {
            const angle = angleStep * i;
            const x = centerX + Math.cos(angle) * spacing;
            const z = centerZ + Math.sin(angle) * spacing;
            soldier.setPosition(x, GAME_CONFIG.SOLDIER_SIZE, z);
        });
    }

    update(delta, input, arena) {
        if (!input || this.soldiers.length === 0) return;

        // Calculate speed
        const baseSpeed = GAME_CONFIG.SOLDIER_BASE_SPEED;
        const sizePenalty = 1 - Math.max(0, this.soldiers.length - GAME_CONFIG.SOLDIERS_PER_ARMY) * GAME_CONFIG.SPEED_PENALTY_PER_SOLDIER;
        const speedMult = Math.max(sizePenalty, GAME_CONFIG.MIN_SPEED_MULTIPLIER);

        // Zone effect
        const leaderPos = this.leader ? this.leader.getPosition() : new THREE.Vector3();
        const zoneMult = arena.getSlowMultiplier ? arena.getSlowMultiplier(leaderPos.x, leaderPos.z) : 1;

        const finalSpeed = baseSpeed * speedMult * zoneMult * this.speedMultiplier;

        // Handle reversed controls
        let moveX = input.x || 0;
        let moveZ = input.z || 0;
        if (this.isReversed) {
            moveX = -moveX;
            moveZ = -moveZ;
        }

        // Move leader
        if (this.leader) {
            this.moveLeader(delta, moveX, moveZ, finalSpeed, arena);
        }

        // Move followers
        this.updateFollowers(delta, finalSpeed, arena);

        // Animate all soldiers
        this.soldiers.forEach(soldier => soldier.update(delta));
    }

    moveLeader(delta, inputX, inputZ, speed, arena) {
        if (!this.leader) return;

        const movement = speed * delta;
        let newX = this.leader.mesh.position.x + inputX * movement;
        let newZ = this.leader.mesh.position.z + inputZ * movement;

        // Wall collision
        const collision = arena.checkWallCollision(newX, newZ, GAME_CONFIG.SOLDIER_COLLISION_RADIUS);
        if (collision.collision) {
            if (Math.abs(collision.pushX) > Math.abs(collision.pushZ)) {
                newX = this.leader.mesh.position.x;
            } else {
                newZ = this.leader.mesh.position.z;
            }
        }

        // Bounds
        const { ARENA_WIDTH, ARENA_HEIGHT } = GAME_CONFIG;
        const margin = GAME_CONFIG.SOLDIER_COLLISION_RADIUS;
        newX = Math.max(-ARENA_WIDTH / 2 + margin, Math.min(ARENA_WIDTH / 2 - margin, newX));
        newZ = Math.max(-ARENA_HEIGHT / 2 + margin, Math.min(ARENA_HEIGHT / 2 - margin, newZ));

        this.leader.mesh.position.x = newX;
        this.leader.mesh.position.z = newZ;

        // Rotate to face movement
        if (inputX !== 0 || inputZ !== 0) {
            this.leader.mesh.rotation.y = Math.atan2(inputX, inputZ);
        }
    }

    updateFollowers(delta, speed, arena) {
        const followers = this.soldiers.filter(s => !s.isLeader);

        followers.forEach((soldier, index) => {
            const target = index === 0 ? this.leader : followers[index - 1];
            if (!target) return;

            const targetPos = target.mesh.position;
            const currentPos = soldier.mesh.position;

            const dx = targetPos.x - currentPos.x;
            const dz = targetPos.z - currentPos.z;
            const distance = Math.sqrt(dx * dx + dz * dz);

            if (distance > GAME_CONFIG.FOLLOW_DISTANCE) {
                const moveSpeed = speed * GAME_CONFIG.FOLLOW_SMOOTHING * (1 + (distance - GAME_CONFIG.FOLLOW_DISTANCE));

                let newX = currentPos.x + (dx / distance) * moveSpeed;
                let newZ = currentPos.z + (dz / distance) * moveSpeed;

                // Collision
                const collision = arena.checkWallCollision(newX, newZ, GAME_CONFIG.SOLDIER_COLLISION_RADIUS);
                if (collision.collision) {
                    if (Math.abs(collision.pushX) > Math.abs(collision.pushZ)) {
                        newX = currentPos.x;
                    } else {
                        newZ = currentPos.z;
                    }
                }

                // Bounds
                const { ARENA_WIDTH, ARENA_HEIGHT } = GAME_CONFIG;
                const margin = GAME_CONFIG.SOLDIER_COLLISION_RADIUS;
                newX = Math.max(-ARENA_WIDTH / 2 + margin, Math.min(ARENA_WIDTH / 2 - margin, newX));
                newZ = Math.max(-ARENA_HEIGHT / 2 + margin, Math.min(ARENA_HEIGHT / 2 - margin, newZ));

                soldier.mesh.position.x = newX;
                soldier.mesh.position.z = newZ;

                if (dx !== 0 || dz !== 0) {
                    soldier.mesh.rotation.y = Math.atan2(dx, dz);
                }
            }
        });
    }

    updatePlacement(delta) {
        this.soldiers.forEach(soldier => soldier.update(delta));
    }

    addSoldier(soldier) {
        this.soldiers.push(soldier);
    }

    removeSoldier(soldier) {
        const index = this.soldiers.indexOf(soldier);
        if (index !== -1) {
            this.soldiers.splice(index, 1);

            // If leader removed, promote new one
            if (soldier.isLeader && this.soldiers.length > 0) {
                this.promoteNewLeader();
            } else if (soldier.isLeader) {
                this.leader = null;
            }
        }
    }

    promoteNewLeader() {
        if (this.soldiers.length === 0) {
            this.leader = null;
            return;
        }

        const newLeader = this.soldiers[0];
        newLeader.isLeader = true;
        this.leader = newLeader;

        // Update appearance
        const size = GAME_CONFIG.LEADER_SIZE / GAME_CONFIG.SOLDIER_SIZE;
        newLeader.mesh.scale.setScalar(size);

        // Update color using imported COLORS
        if (newLeader.modelMesh && newLeader.modelMesh.material) {
            newLeader.modelMesh.material.color.setHex(COLORS[this.type].light);
        }
    }

    // Power-up methods
    activateSpeedBoost(duration, multiplier) {
        this.speedMultiplier = multiplier;
        setTimeout(() => { this.speedMultiplier = 1; }, duration * 1000);
    }

    activateInvincibility(duration) {
        this.isInvincible = true;

        this.soldiers.forEach(s => {
            if (s.modelMesh && s.modelMesh.material) {
                s.modelMesh.material.emissive = new THREE.Color(0xffd700);
                s.modelMesh.material.emissiveIntensity = 0.5;
            }
        });

        setTimeout(() => {
            this.isInvincible = false;
            this.soldiers.forEach(s => {
                if (s.modelMesh && s.modelMesh.material) {
                    s.modelMesh.material.emissive = new THREE.Color(0x000000);
                    s.modelMesh.material.emissiveIntensity = 0;
                }
            });
        }, duration * 1000);
    }

    activateReverseControl(duration) {
        this.isReversed = true;
        setTimeout(() => { this.isReversed = false; }, duration * 1000);
    }

    activateMagnet(duration) {
        this.magnetActive = true;
        setTimeout(() => { this.magnetActive = false; }, duration * 1000);
    }

    createSoldiers() {
        this.spawnCounter = 0;

        // Create leader first
        const leaderId = `${this.type}_LEADER`;
        this.leader = new Soldier(this.scene, this.type, true, leaderId);
        this.soldiers.push(this.leader);

        // Create regular soldiers
        for (let i = 1; i < GAME_CONFIG.SOLDIERS_PER_ARMY; i++) {
            const id = `${this.type}_${this.spawnCounter++}`;
            const soldier = new Soldier(this.scene, this.type, false, id);
            this.soldiers.push(soldier);
        }
    }

    // ... (keep setSpawnPosition and other methods) ...

    reinforceSoldiers(count) {
        const currentCount = this.soldiers.length;
        const toAdd = Math.min(count, this.maxSoldiers - currentCount);

        for (let i = 0; i < toAdd; i++) {
            // Use a high range for reinforcements to avoid ID collisions with initial spawn
            // or just increment the global counter for this army
            const id = `${this.type}_R_${Date.now()}_${i}`; // 'R' for reinforcement
            const soldier = new Soldier(this.scene, this.type, false, id);

            if (this.leader) {
                const leaderPos = this.leader.getPosition();
                const angle = Math.random() * Math.PI * 2;
                const dist = GAME_CONFIG.FOLLOW_DISTANCE * 2;
                soldier.setPosition(
                    leaderPos.x + Math.cos(angle) * dist,
                    GAME_CONFIG.SOLDIER_SIZE,
                    leaderPos.z + Math.sin(angle) * dist
                );
            }

            this.soldiers.push(soldier);
        }
    }

    destroy() {
        this.soldiers.forEach(soldier => soldier.destroy());
        this.soldiers = [];
        this.leader = null;
    }
}
