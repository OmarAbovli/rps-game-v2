// Soldier - Individual unit with 3D model and behavior
import * as THREE from 'three';
import { COLORS, GAME_CONFIG, SOLDIER_TYPES } from '../utils/constants.js';

export class Soldier {
    constructor(scene, type, isLeader = false, id = null) {
        this.scene = scene;
        this.type = type;
        this.isLeader = isLeader;
        this.isConverting = false;
        this.isDragging = false;
        this.id = id || Math.random().toString(36).substr(2, 9);

        // Create 3D mesh
        this.mesh = this.createMesh();
        this.scene.add(this.mesh);

        // Velocity for smooth movement
        this.velocity = new THREE.Vector3();
        this.targetPosition = null;
    }

    createMesh() {
        const size = this.isLeader ? GAME_CONFIG.LEADER_SIZE : GAME_CONFIG.SOLDIER_SIZE;
        const colors = COLORS[this.type];
        const color = this.isLeader ? colors.light : colors.main;

        // Create group to hold the model
        const group = new THREE.Group();

        // Create the actual 3D shape based on type
        const model = this.createTypeModel(this.type, size, color);
        group.add(model);

        group.castShadow = true;
        group.receiveShadow = true;
        group.userData.soldier = this;

        // Add outline for leader
        if (this.isLeader) {
            this.addLeaderGlow(group, size);
        }

        this.modelMesh = model;
        return group;
    }

    createTypeModel(type, size, color) {
        let geometry;

        switch (type) {
            case SOLDIER_TYPES.ROCK:
                geometry = this.createRockGeometry(size);
                break;
            case SOLDIER_TYPES.PAPER:
                geometry = this.createPaperGeometry(size);
                break;
            case SOLDIER_TYPES.SCISSORS:
                geometry = this.createScissorsGeometry(size);
                break;
            default:
                geometry = new THREE.SphereGeometry(size, 16, 16);
        }

        const material = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.4,
            metalness: 0.3,
            flatShading: true
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        return mesh;
    }

    createRockGeometry(size) {
        // More obvious rock shape - larger dodecahedron with bumps
        const geometry = new THREE.DodecahedronGeometry(size * 1.2, 1);
        const positions = geometry.attributes.position;

        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);
            const z = positions.getZ(i);

            // Add larger random perturbation for rocky look
            const noise = (Math.random() - 0.5) * 0.25 * size;
            positions.setXYZ(i, x + noise, y + noise * 0.5, z + noise);
        }

        geometry.computeVertexNormals();
        return geometry;
    }

    createPaperGeometry(size) {
        // Flat paper shape - wider and more obvious
        const geometry = new THREE.BoxGeometry(size * 2.5, size * 0.15, size * 2);
        const positions = geometry.attributes.position;

        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);

            // More pronounced wave effect
            const wave = Math.sin(x * 2) * 0.1 * size;
            positions.setY(i, y + wave);
        }

        geometry.computeVertexNormals();
        return geometry;
    }

    createScissorsGeometry(size) {
        // Clear X-shape scissors using two crossed blades
        const bladeWidth = size * 0.3;
        const bladeLength = size * 2;
        const bladeThickness = size * 0.2;

        // Create two blade shapes that cross
        const blade1 = new THREE.BoxGeometry(bladeLength, bladeThickness, bladeWidth);
        const blade2 = new THREE.BoxGeometry(bladeLength, bladeThickness, bladeWidth);

        // Combine into one geometry
        const geometry = new THREE.BufferGeometry();

        // For scissors, we'll use a merged geometry approach
        // Create an X shape by rotating one blade
        const shape = new THREE.Shape();

        // Draw X shape for scissors blades
        const arm = size * 1.2;
        const thick = size * 0.25;

        // Right arm
        shape.moveTo(thick, 0);
        shape.lineTo(arm, arm - thick);
        shape.lineTo(arm, arm);
        shape.lineTo(arm - thick, arm);
        shape.lineTo(0, thick);
        // Left arm  
        shape.lineTo(-arm + thick, arm);
        shape.lineTo(-arm, arm);
        shape.lineTo(-arm, arm - thick);
        shape.lineTo(-thick, 0);
        // Bottom left
        shape.lineTo(-arm, -arm + thick);
        shape.lineTo(-arm, -arm);
        shape.lineTo(-arm + thick, -arm);
        shape.lineTo(0, -thick);
        // Bottom right
        shape.lineTo(arm - thick, -arm);
        shape.lineTo(arm, -arm);
        shape.lineTo(arm, -arm + thick);
        shape.closePath();

        const extrudeSettings = {
            depth: size * 0.3,
            bevelEnabled: true,
            bevelThickness: size * 0.05,
            bevelSize: size * 0.05,
            bevelSegments: 2
        };

        const extruded = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        extruded.rotateX(Math.PI / 2);

        return extruded;
    }

    addLeaderGlow(group, size) {
        // Add glowing ring around leader
        const ringSize = size * 1.5;
        const ringGeometry = new THREE.RingGeometry(ringSize, ringSize * 1.15, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: COLORS[this.type].light,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide
        });

        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.05;
        group.add(ring);

        this.leaderRing = ring;
    }

    setPosition(x, y, z) {
        this.mesh.position.set(x, y, z);
    }

    getPosition() {
        return this.mesh.position.clone();
    }

    moveTowards(targetX, targetZ, speed, delta) {
        const dx = targetX - this.mesh.position.x;
        const dz = targetZ - this.mesh.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        if (distance > 0.01) {
            const moveX = (dx / distance) * speed * delta;
            const moveZ = (dz / distance) * speed * delta;

            this.mesh.position.x += moveX;
            this.mesh.position.z += moveZ;

            // Rotate to face movement direction
            if (distance > 0.1) {
                const angle = Math.atan2(dx, dz);
                this.mesh.rotation.y = angle;
            }
        }
    }

    update(delta) {
        // Bobbing animation
        const time = Date.now() * 0.003;
        const bobHeight = this.isLeader ? 0.15 : 0.08;
        const baseY = GAME_CONFIG.SOLDIER_SIZE * 1.5;
        this.mesh.position.y = baseY + Math.sin(time + this.id.charCodeAt(0)) * bobHeight;

        // Leader ring pulse
        if (this.leaderRing) {
            this.leaderRing.material.opacity = 0.4 + Math.sin(time * 2) * 0.2;
            this.leaderRing.rotation.z += delta * 0.5;
        }
    }

    changeType(newType) {
        const oldType = this.type;
        this.type = newType;

        // IMPORTANT: Recreate the entire model with new geometry
        const size = this.isLeader ? GAME_CONFIG.LEADER_SIZE : GAME_CONFIG.SOLDIER_SIZE;
        const colors = COLORS[newType];
        const color = this.isLeader ? colors.light : colors.main;

        // Remove old model
        if (this.modelMesh) {
            this.mesh.remove(this.modelMesh);
            this.modelMesh.geometry.dispose();
            this.modelMesh.material.dispose();
        }

        // Create new model with correct type
        const newModel = this.createTypeModel(newType, size, color);
        this.mesh.add(newModel);
        this.modelMesh = newModel;

        // Update leader ring color
        if (this.leaderRing) {
            this.leaderRing.material.color.setHex(colors.light);
        }
    }

    playConversionEffect(callback) {
        // Flash white and scale effect
        const startScale = this.mesh.scale.x;

        // Flash sequence
        const flashDuration = 400;
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / flashDuration;

            if (progress < 1) {
                // Flash white
                if (this.modelMesh && this.modelMesh.material) {
                    const flash = Math.sin(progress * Math.PI * 6);
                    if (flash > 0) {
                        this.modelMesh.material.emissive = new THREE.Color(0xffffff);
                        this.modelMesh.material.emissiveIntensity = 0.8;
                    } else {
                        this.modelMesh.material.emissive = new THREE.Color(0x000000);
                        this.modelMesh.material.emissiveIntensity = 0;
                    }
                }

                // Pulse scale
                const scale = startScale + Math.sin(progress * Math.PI) * 0.4;
                this.mesh.scale.setScalar(scale);

                requestAnimationFrame(animate);
            } else {
                this.mesh.scale.setScalar(startScale);
                if (this.modelMesh && this.modelMesh.material) {
                    this.modelMesh.material.emissive = new THREE.Color(0x000000);
                    this.modelMesh.material.emissiveIntensity = 0;
                }
                if (callback) callback();
            }
        };

        animate();
    }

    destroy() {
        this.scene.remove(this.mesh);
        if (this.modelMesh) {
            if (this.modelMesh.geometry) this.modelMesh.geometry.dispose();
            if (this.modelMesh.material) this.modelMesh.material.dispose();
        }
        if (this.leaderRing) {
            this.leaderRing.geometry.dispose();
            this.leaderRing.material.dispose();
        }
    }
}
