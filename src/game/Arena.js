// Arena - Clean battlefield with fewer obstacles
import * as THREE from 'three';
import { GAME_CONFIG, COLORS, SOLDIER_TYPES } from '../utils/constants.js';

export class Arena {
    constructor(scene) {
        this.scene = scene;
        this.objects = [];
        this.walls = [];
        this.slowZones = [];
        this.speedZones = [];

        this.create();
    }

    create() {
        this.createFloor();
        this.createSpawnZones();
        this.createSimpleObstacles();
        this.createBoundaryWalls();
    }

    createFloor() {
        const { ARENA_WIDTH, ARENA_HEIGHT } = GAME_CONFIG;

        // Simple clean floor
        const floorGeometry = new THREE.PlaneGeometry(ARENA_WIDTH, ARENA_HEIGHT);
        const floorMaterial = new THREE.MeshStandardMaterial({
            color: COLORS.arena.floor,
            roughness: 0.9,
            metalness: 0.1
        });

        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0;
        floor.receiveShadow = true;
        this.scene.add(floor);
        this.objects.push(floor);

        // Subtle grid
        const gridHelper = new THREE.GridHelper(
            Math.max(ARENA_WIDTH, ARENA_HEIGHT),
            30,
            0x333333,
            0x2a2a2a
        );
        gridHelper.position.y = 0.01;
        this.scene.add(gridHelper);
        this.objects.push(gridHelper);
    }

    createSpawnZones() {
        const { ARENA_WIDTH, ARENA_HEIGHT } = GAME_CONFIG;

        // Large spawn zones in triangular formation
        const zoneWidth = 10;
        const zoneHeight = 8;

        this.spawnZones = {
            [SOLDIER_TYPES.ROCK]: {
                x: -ARENA_WIDTH / 3,
                z: ARENA_HEIGHT / 3 - 1,
                width: zoneWidth,
                height: zoneHeight
            },
            [SOLDIER_TYPES.PAPER]: {
                x: ARENA_WIDTH / 3,
                z: ARENA_HEIGHT / 3 - 1,
                width: zoneWidth,
                height: zoneHeight
            },
            [SOLDIER_TYPES.SCISSORS]: {
                x: 0,
                z: -ARENA_HEIGHT / 3 + 1,
                width: zoneWidth,
                height: zoneHeight
            }
        };

        // Draw spawn zones
        Object.entries(this.spawnZones).forEach(([type, zone]) => {
            const colorKey = `spawn${type.charAt(0).toUpperCase() + type.slice(1)}`;
            const color = COLORS.arena[colorKey];
            this.createZoneMarker(zone.x, zone.z, zone.width, zone.height, color, 0.3);
        });

        // Central area
        this.neutralZone = { x: 0, z: 0, width: 8, height: 8 };
        this.createCenterRing();
    }

    createZoneMarker(x, z, width, height, color, opacity) {
        const geometry = new THREE.PlaneGeometry(width, height);
        const material = new THREE.MeshStandardMaterial({
            color: color,
            transparent: true,
            opacity: opacity,
            roughness: 0.9
        });
        const zone = new THREE.Mesh(geometry, material);
        zone.rotation.x = -Math.PI / 2;
        zone.position.set(x, 0.02, z);
        zone.receiveShadow = true;
        this.scene.add(zone);
        this.objects.push(zone);
    }

    createCenterRing() {
        // Battle ring in center
        const ringGeometry = new THREE.RingGeometry(3, 4, 32);
        const ringMaterial = new THREE.MeshStandardMaterial({
            color: 0xff6b35,
            transparent: true,
            opacity: 0.25,
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(0, 0.02, 0);
        this.scene.add(ring);
        this.objects.push(ring);
    }

    createSimpleObstacles() {
        // Only a few simple obstacles - REMOVED the corner fortifications user marked with X
        const { ARENA_WIDTH, ARENA_HEIGHT } = GAME_CONFIG;

        // Just 4 simple walls near center for tactical play
        this.createWall(-5, 0, 1.5, 4);
        this.createWall(5, 0, 1.5, 4);
        this.createWall(0, 5, 4, 1.5);
        this.createWall(0, -5, 4, 1.5);

        // 2 slow zones in the middle paths
        this.createSlowZone(-ARENA_WIDTH / 5, 0, 2);
        this.createSlowZone(ARENA_WIDTH / 5, 0, 2);

        // 2 speed zones on sides
        this.createSpeedZone(-ARENA_WIDTH / 3, -ARENA_HEIGHT / 4, 2);
        this.createSpeedZone(ARENA_WIDTH / 3, -ARENA_HEIGHT / 4, 2);
    }

    createWall(x, z, width, depth) {
        const height = 1.2;

        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshStandardMaterial({
            color: COLORS.arena.wall,
            roughness: 0.6,
            metalness: 0.3
        });

        const wall = new THREE.Mesh(geometry, material);
        wall.position.set(x, height / 2, z);
        wall.castShadow = true;
        wall.receiveShadow = true;

        wall.userData = {
            isWall: true,
            bounds: {
                minX: x - width / 2,
                maxX: x + width / 2,
                minZ: z - depth / 2,
                maxZ: z + depth / 2
            }
        };

        this.scene.add(wall);
        this.objects.push(wall);
        this.walls.push(wall);
    }

    createSlowZone(x, z, radius) {
        const geometry = new THREE.CircleGeometry(radius, 32);
        const material = new THREE.MeshStandardMaterial({
            color: COLORS.arena.slowZone,
            transparent: true,
            opacity: 0.35,
            roughness: 0.9
        });

        const zone = new THREE.Mesh(geometry, material);
        zone.rotation.x = -Math.PI / 2;
        zone.position.set(x, 0.03, z);

        zone.userData = {
            isSlowZone: true,
            center: new THREE.Vector2(x, z),
            radius: radius,
            slowMultiplier: 0.5
        };

        this.scene.add(zone);
        this.objects.push(zone);
        this.slowZones.push(zone);
    }

    createSpeedZone(x, z, radius) {
        const geometry = new THREE.CircleGeometry(radius, 32);
        const material = new THREE.MeshStandardMaterial({
            color: COLORS.arena.speedZone,
            transparent: true,
            opacity: 0.35,
            emissive: COLORS.arena.speedZone,
            emissiveIntensity: 0.15
        });

        const zone = new THREE.Mesh(geometry, material);
        zone.rotation.x = -Math.PI / 2;
        zone.position.set(x, 0.03, z);

        zone.userData = {
            isSpeedZone: true,
            center: new THREE.Vector2(x, z),
            radius: radius,
            speedMultiplier: 1.5
        };

        this.scene.add(zone);
        this.objects.push(zone);
        this.speedZones.push(zone);
    }

    createBoundaryWalls() {
        const { ARENA_WIDTH, ARENA_HEIGHT } = GAME_CONFIG;
        const thickness = 0.5;
        const height = 0.8;

        const boundaries = [
            { x: 0, z: -ARENA_HEIGHT / 2 - thickness / 2, w: ARENA_WIDTH + thickness * 2, d: thickness },
            { x: 0, z: ARENA_HEIGHT / 2 + thickness / 2, w: ARENA_WIDTH + thickness * 2, d: thickness },
            { x: -ARENA_WIDTH / 2 - thickness / 2, z: 0, w: thickness, d: ARENA_HEIGHT },
            { x: ARENA_WIDTH / 2 + thickness / 2, z: 0, w: thickness, d: ARENA_HEIGHT },
        ];

        boundaries.forEach(b => {
            const geometry = new THREE.BoxGeometry(b.w, height, b.d);
            const material = new THREE.MeshStandardMaterial({
                color: 0x1a1a2e,
                roughness: 0.8
            });

            const wall = new THREE.Mesh(geometry, material);
            wall.position.set(b.x, height / 2, b.z);
            wall.castShadow = true;

            wall.userData = {
                isBoundary: true,
                bounds: {
                    minX: b.x - b.w / 2,
                    maxX: b.x + b.w / 2,
                    minZ: b.z - b.d / 2,
                    maxZ: b.z + b.d / 2
                }
            };

            this.scene.add(wall);
            this.objects.push(wall);
            this.walls.push(wall);
        });
    }

    getSpawnZone(type) {
        return this.spawnZones[type];
    }

    isInNeutralZone(x, z) {
        const zone = this.neutralZone;
        return (
            x >= zone.x - zone.width / 2 &&
            x <= zone.x + zone.width / 2 &&
            z >= zone.z - zone.height / 2 &&
            z <= zone.z + zone.height / 2
        );
    }

    isInSpawnZone(x, z, type) {
        const zone = this.spawnZones[type];
        return (
            x >= zone.x - zone.width / 2 &&
            x <= zone.x + zone.width / 2 &&
            z >= zone.z - zone.height / 2 &&
            z <= zone.z + zone.height / 2
        );
    }

    checkWallCollision(x, z, radius = 0.5) {
        for (const wall of this.walls) {
            const bounds = wall.userData.bounds;

            const closestX = Math.max(bounds.minX, Math.min(x, bounds.maxX));
            const closestZ = Math.max(bounds.minZ, Math.min(z, bounds.maxZ));

            const distX = x - closestX;
            const distZ = z - closestZ;
            const distSquared = distX * distX + distZ * distZ;

            if (distSquared < radius * radius) {
                return { collision: true, wall, pushX: distX, pushZ: distZ };
            }
        }
        return { collision: false };
    }

    getSlowMultiplier(x, z) {
        // Speed zones first
        for (const zone of this.speedZones) {
            const center = zone.userData.center;
            const dist = Math.sqrt((x - center.x) ** 2 + (z - center.y) ** 2);
            if (dist < zone.userData.radius) {
                return zone.userData.speedMultiplier;
            }
        }

        // Slow zones
        for (const zone of this.slowZones) {
            const center = zone.userData.center;
            const dist = Math.sqrt((x - center.x) ** 2 + (z - center.y) ** 2);
            if (dist < zone.userData.radius) {
                return zone.userData.slowMultiplier;
            }
        }

        return 1;
    }

    getRandomPowerUpPosition() {
        const { ARENA_WIDTH, ARENA_HEIGHT } = GAME_CONFIG;
        const margin = 3;

        for (let attempts = 0; attempts < 20; attempts++) {
            const x = (Math.random() - 0.5) * (ARENA_WIDTH - margin * 2);
            const z = (Math.random() - 0.5) * (ARENA_HEIGHT - margin * 2);

            if (!this.checkWallCollision(x, z, 1.5).collision) {
                return { x, z };
            }
        }

        return { x: 0, z: 0 };
    }

    destroy() {
        this.objects.forEach(obj => {
            this.scene.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(m => m.dispose());
                } else {
                    obj.material.dispose();
                }
            }
        });
        this.objects = [];
        this.walls = [];
        this.slowZones = [];
        this.speedZones = [];
    }
}
