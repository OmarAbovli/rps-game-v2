// PowerUpManager - Spawns and manages power-ups with unique 3D designs
import * as THREE from 'three';
import { GAME_CONFIG, POWERUP_TYPES, POWERUP_CONFIG } from '../utils/constants.js';

export class PowerUpManager {
    constructor(scene, game) {
        this.scene = scene;
        this.game = game;

        this.powerUps = [];
        this.isSpawning = false;
        this.spawnTimer = 0;
    }

    startSpawning() {
        this.isSpawning = true;
        this.spawnTimer = GAME_CONFIG.POWERUP_SPAWN_INTERVAL;
    }

    stopSpawning() {
        this.isSpawning = false;
        this.powerUps.forEach(p => p.destroy());
        this.powerUps = [];
    }

    update(delta) {
        if (!this.isSpawning) return;

        this.spawnTimer -= delta;
        if (this.spawnTimer <= 0) {
            this.spawnPowerUp();
            this.spawnTimer = GAME_CONFIG.POWERUP_SPAWN_INTERVAL +
                (Math.random() - 0.5) * GAME_CONFIG.POWERUP_SPAWN_VARIANCE * 2;
        }

        this.powerUps.forEach(p => p.update(delta));
        this.checkCollection();
        this.powerUps = this.powerUps.filter(p => !p.isCollected);
    }

    spawnPowerUp() {
        const types = Object.values(POWERUP_TYPES);
        const randomType = types[Math.floor(Math.random() * types.length)];

        const position = this.game.arena.getRandomPowerUpPosition();
        const powerUp = new PowerUp(this.scene, randomType, position.x, position.z);
        this.powerUps.push(powerUp);

        console.log('⭐ Power-up spawned:', randomType);
    }

    checkCollection() {
        this.game.armies.forEach((army) => {
            army.soldiers.forEach(soldier => {
                const soldierPos = soldier.mesh.position;

                this.powerUps.forEach(powerUp => {
                    if (powerUp.isCollected) return;

                    const dist = soldierPos.distanceTo(powerUp.mesh.position);
                    if (dist < 1.2) {
                        this.collectPowerUp(powerUp, army);
                    }
                });
            });
        });
    }

    collectPowerUp(powerUp, army) {
        powerUp.collect();
        this.game.app.audio.playPowerUp();
        this.applyPowerUp(powerUp.type, army);

        const config = POWERUP_CONFIG[powerUp.type];
        this.game.app.ui.showPowerUpActive(config.icon, config.duration || 0);

        console.log('✨ Power-up collected:', powerUp.type, 'by', army.type);
    }

    applyPowerUp(type, army) {
        const config = POWERUP_CONFIG[type];

        switch (type) {
            case POWERUP_TYPES.SPEED_BOOST:
                army.activateSpeedBoost(config.duration, config.multiplier);
                break;

            case POWERUP_TYPES.INVINCIBILITY:
                army.activateInvincibility(config.duration);
                break;

            case POWERUP_TYPES.REINFORCEMENT:
                army.reinforceSoldiers(config.soldiersToRestore);
                break;

            case POWERUP_TYPES.MAGNET_AURA:
                army.activateMagnet(config.duration);
                break;

            case POWERUP_TYPES.SPLIT_FORMATION:
                this.applySplitToEnemies(army, config.duration);
                break;

            case POWERUP_TYPES.CLONE_LEADER:
                this.createCloneLeader(army, config.duration);
                break;

            case POWERUP_TYPES.REVERSE_CONTROL:
                this.applyReverseToRandomEnemy(army, config.duration);
                break;
        }
    }

    applySplitToEnemies(army) {
        this.game.armies.forEach((enemyArmy, type) => {
            if (type === army.type) return;

            enemyArmy.soldiers.forEach(soldier => {
                if (soldier.isLeader) return;

                const angle = Math.random() * Math.PI * 2;
                const force = 3;
                soldier.mesh.position.x += Math.cos(angle) * force;
                soldier.mesh.position.z += Math.sin(angle) * force;
            });
        });
    }

    createCloneLeader(army, duration) {
        const leaderPos = army.leader.getPosition();

        const decoyGeometry = new THREE.SphereGeometry(GAME_CONFIG.LEADER_SIZE, 16, 16);
        const decoyMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.7
        });

        const decoy = new THREE.Mesh(decoyGeometry, decoyMaterial);
        decoy.position.copy(leaderPos);
        decoy.position.x += (Math.random() - 0.5) * 4;
        decoy.position.z += (Math.random() - 0.5) * 4;
        this.scene.add(decoy);

        const startTime = Date.now();
        const animate = () => {
            const elapsed = (Date.now() - startTime) / 1000;
            if (elapsed < duration) {
                decoy.position.y = 0.5 + Math.sin(elapsed * 5) * 0.1;
                decoy.rotation.y += 0.1;
                requestAnimationFrame(animate);
            } else {
                this.scene.remove(decoy);
                decoyGeometry.dispose();
                decoyMaterial.dispose();
            }
        };
        animate();
    }

    applyReverseToRandomEnemy(army, duration) {
        const enemyTypes = Array.from(this.game.armies.keys()).filter(t => t !== army.type);
        if (enemyTypes.length === 0) return;

        const randomType = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
        const enemyArmy = this.game.armies.get(randomType);

        if (enemyArmy) {
            enemyArmy.activateReverseControl(duration);
        }
    }

    destroy() {
        this.powerUps.forEach(p => p.destroy());
        this.powerUps = [];
    }
}

// Individual Power-Up with unique 3D shapes
class PowerUp {
    constructor(scene, type, x, z) {
        this.scene = scene;
        this.type = type;
        this.isCollected = false;

        this.mesh = this.createMesh();
        this.mesh.position.set(x, 0.8, z);
        this.scene.add(this.mesh);

        this.startTime = Date.now();
    }

    createMesh() {
        const config = POWERUP_CONFIG[this.type];
        const size = GAME_CONFIG.POWERUP_SIZE || 0.5;

        // Create unique shape based on power-up type
        const group = new THREE.Group();
        let geometry;

        switch (config.shape) {
            case 'lightning':
                geometry = this.createLightningShape(size);
                break;
            case 'shield':
                geometry = this.createShieldShape(size);
                break;
            case 'plus':
                geometry = this.createPlusShape(size);
                break;
            case 'magnet':
                geometry = this.createMagnetShape(size);
                break;
            case 'star':
                geometry = this.createStarShape(size);
                break;
            case 'person':
                geometry = this.createPersonShape(size);
                break;
            case 'arrows':
                geometry = this.createArrowsShape(size);
                break;
            default:
                geometry = new THREE.OctahedronGeometry(size, 0);
        }

        const material = new THREE.MeshStandardMaterial({
            color: config.color,
            emissive: config.color,
            emissiveIntensity: 0.6,
            roughness: 0.2,
            metalness: 0.7
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        group.add(mesh);

        // Add glow effect
        const glowGeometry = new THREE.SphereGeometry(size * 1.3, 16, 16);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: config.color,
            transparent: true,
            opacity: 0.25
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        group.add(glow);
        this.glow = glow;

        this.innerMesh = mesh;
        return group;
    }

    // ⚡ Lightning bolt shape
    createLightningShape(size) {
        const shape = new THREE.Shape();
        shape.moveTo(0, size * 1.5);
        shape.lineTo(size * 0.4, size * 0.3);
        shape.lineTo(size * 0.15, size * 0.3);
        shape.lineTo(size * 0.5, -size * 1.5);
        shape.lineTo(0, -size * 0.2);
        shape.lineTo(size * 0.25, -size * 0.2);
        shape.lineTo(-size * 0.3, size * 1.5);
        shape.closePath();

        const extrudeSettings = { depth: size * 0.3, bevelEnabled: false };
        return new THREE.ExtrudeGeometry(shape, extrudeSettings);
    }

    // 🛡️ Shield shape
    createShieldShape(size) {
        const shape = new THREE.Shape();
        shape.moveTo(0, size * 1.2);
        shape.quadraticCurveTo(size * 1.2, size * 0.8, size * 1.2, 0);
        shape.quadraticCurveTo(size * 1.2, -size * 0.8, 0, -size * 1.2);
        shape.quadraticCurveTo(-size * 1.2, -size * 0.8, -size * 1.2, 0);
        shape.quadraticCurveTo(-size * 1.2, size * 0.8, 0, size * 1.2);

        const extrudeSettings = { depth: size * 0.25, bevelEnabled: true, bevelSize: size * 0.1, bevelThickness: size * 0.1 };
        return new THREE.ExtrudeGeometry(shape, extrudeSettings);
    }

    // 👥 Plus/Cross shape (Reinforcement)
    createPlusShape(size) {
        const shape = new THREE.Shape();
        const w = size * 0.4;
        const l = size * 1.2;

        shape.moveTo(-w, l);
        shape.lineTo(w, l);
        shape.lineTo(w, w);
        shape.lineTo(l, w);
        shape.lineTo(l, -w);
        shape.lineTo(w, -w);
        shape.lineTo(w, -l);
        shape.lineTo(-w, -l);
        shape.lineTo(-w, -w);
        shape.lineTo(-l, -w);
        shape.lineTo(-l, w);
        shape.lineTo(-w, w);
        shape.closePath();

        const extrudeSettings = { depth: size * 0.3, bevelEnabled: false };
        return new THREE.ExtrudeGeometry(shape, extrudeSettings);
    }

    // 🧲 U-shaped magnet
    createMagnetShape(size) {
        const shape = new THREE.Shape();
        const outer = size * 1.2;
        const inner = size * 0.6;
        const height = size * 1.5;
        const thickness = size * 0.35;

        // Outer U
        shape.moveTo(-outer, height);
        shape.lineTo(-outer, -height * 0.3);
        shape.quadraticCurveTo(-outer, -height, 0, -height);
        shape.quadraticCurveTo(outer, -height, outer, -height * 0.3);
        shape.lineTo(outer, height);
        shape.lineTo(outer - thickness, height);
        shape.lineTo(outer - thickness, -height * 0.3);
        shape.quadraticCurveTo(outer - thickness, -height + thickness, 0, -height + thickness);
        shape.quadraticCurveTo(-outer + thickness, -height + thickness, -outer + thickness, -height * 0.3);
        shape.lineTo(-outer + thickness, height);
        shape.closePath();

        const extrudeSettings = { depth: size * 0.3, bevelEnabled: false };
        return new THREE.ExtrudeGeometry(shape, extrudeSettings);
    }

    // 💫 Star burst shape
    createStarShape(size) {
        const shape = new THREE.Shape();
        const points = 6;
        const outerRadius = size * 1.2;
        const innerRadius = size * 0.5;

        for (let i = 0; i < points * 2; i++) {
            const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;

            if (i === 0) {
                shape.moveTo(x, y);
            } else {
                shape.lineTo(x, y);
            }
        }
        shape.closePath();

        const extrudeSettings = { depth: size * 0.25, bevelEnabled: true, bevelSize: size * 0.05 };
        return new THREE.ExtrudeGeometry(shape, extrudeSettings);
    }

    // 👤 Person silhouette shape
    createPersonShape(size) {
        // Head
        const headGeom = new THREE.SphereGeometry(size * 0.4, 16, 16);
        const bodyGeom = new THREE.CapsuleGeometry(size * 0.3, size * 0.8, 8, 16);

        // Merge into one - just use capsule for simplicity
        return new THREE.CapsuleGeometry(size * 0.35, size * 1.2, 8, 16);
    }

    // 🔄 Rotating arrows shape
    createArrowsShape(size) {
        const shape = new THREE.Shape();
        const r = size * 1.0;
        const thickness = size * 0.25;

        // Curved arrow - simplified as ring segment
        return new THREE.TorusGeometry(r, thickness, 8, 16, Math.PI * 1.5);
    }

    update(delta) {
        if (this.isCollected) return;

        const time = (Date.now() - this.startTime) / 1000;

        // Floating and rotating
        this.mesh.position.y = 0.8 + Math.sin(time * 2.5) * 0.25;
        this.mesh.rotation.y += delta * 1.5;

        // Pulse glow
        if (this.glow) {
            this.glow.scale.setScalar(1 + Math.sin(time * 4) * 0.15);
            this.glow.material.opacity = 0.2 + Math.sin(time * 4) * 0.1;
        }
    }

    collect() {
        this.isCollected = true;

        const startScale = this.mesh.scale.x;
        const startTime = Date.now();
        const duration = 200;

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / duration;

            if (progress < 1) {
                this.mesh.scale.setScalar(startScale * (1 + progress * 2));
                if (this.innerMesh) this.innerMesh.material.opacity = 1 - progress;
                if (this.glow) this.glow.material.opacity = 0.25 * (1 - progress);
                requestAnimationFrame(animate);
            } else {
                this.destroy();
            }
        };
        animate();
    }

    destroy() {
        this.scene.remove(this.mesh);
        if (this.innerMesh) {
            if (this.innerMesh.geometry) this.innerMesh.geometry.dispose();
            if (this.innerMesh.material) this.innerMesh.material.dispose();
        }
        if (this.glow) {
            this.glow.geometry.dispose();
            this.glow.material.dispose();
        }
    }
}
