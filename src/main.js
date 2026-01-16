import * as THREE from 'three';
import { Game } from './game/Game.js';
import { IdentityUI } from './ui/IdentityUI.js';
import { UIManager } from './ui/UIManager.js';
import { NetworkManager } from './network/NetworkManager.js';
import { AudioManager } from './audio/AudioManager.js';
import { GAME_CONFIG } from './utils/constants.js';

class RPSArena {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.game = null;
        this.ui = null;
        this.identityUi = null; // Identity Manager
        this.network = null;
        this.audio = null;
        this.clock = new THREE.Clock();

        this.init();
    }

    init() {
        // Create Three.js scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);

        // RESPONSIVE orthographic camera that fits arena to screen
        this.setupCamera();

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.getElementById('game-container').appendChild(this.renderer.domElement);

        // Lighting
        this.setupLighting();

        // Initialize managers (Safe Init)
        try {
            this.audio = new AudioManager();
            this.network = new NetworkManager(this);
            this.game = new Game(this);

            // Identity and UI (Essential for buttons)
            try {
                this.identityUi = new IdentityUI(this);
            } catch (e) {
                console.error('IdentityUI failed to init:', e);
            }

            this.ui = new UIManager(this);
        } catch (e) {
            console.error('Critical manager initialization failure:', e);
            // Fallback: at least try to show UI if UIManager exists
            if (!this.ui) this.ui = new UIManager(this);
        }

        // Event listeners
        window.addEventListener('resize', () => this.onResize());

        // Resume audio on first click
        document.addEventListener('click', () => this.audio.resume(), { once: true });

        // Start game loop
        this.animate();

        console.log('🎮 RPS Arena initialized!');
    }

    setupCamera() {
        const { ARENA_WIDTH, ARENA_HEIGHT } = GAME_CONFIG;
        const padding = 2; // Extra padding around arena

        const arenaWidth = ARENA_WIDTH + padding * 2;
        const arenaHeight = ARENA_HEIGHT + padding * 2;

        const screenAspect = window.innerWidth / window.innerHeight;
        const arenaAspect = arenaWidth / arenaHeight;

        let viewWidth, viewHeight;

        // Fit arena inside screen (show entire arena)
        if (screenAspect > arenaAspect) {
            // Screen is wider than arena - fit by height
            viewHeight = arenaHeight;
            viewWidth = arenaHeight * screenAspect;
        } else {
            // Screen is taller than arena - fit by width
            viewWidth = arenaWidth;
            viewHeight = arenaWidth / screenAspect;
        }

        this.camera = new THREE.OrthographicCamera(
            -viewWidth / 2,
            viewWidth / 2,
            viewHeight / 2,
            -viewHeight / 2,
            0.1,
            1000
        );
        this.camera.position.set(0, 50, 0);
        this.camera.lookAt(0, 0, 0);
    }

    setupLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        // Main directional light (sun)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 30, 10);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 100;
        directionalLight.shadow.camera.left = -30;
        directionalLight.shadow.camera.right = 30;
        directionalLight.shadow.camera.top = 30;
        directionalLight.shadow.camera.bottom = -30;
        this.scene.add(directionalLight);

        // Colored accent lights
        const blueLight = new THREE.PointLight(0x4ecdc4, 0.4, 40);
        blueLight.position.set(-15, 10, -15);
        this.scene.add(blueLight);

        const orangeLight = new THREE.PointLight(0xff6b35, 0.4, 40);
        orangeLight.position.set(15, 10, 15);
        this.scene.add(orangeLight);
    }

    onResize() {
        const { ARENA_WIDTH, ARENA_HEIGHT } = GAME_CONFIG;
        const padding = 2;

        const arenaWidth = ARENA_WIDTH + padding * 2;
        const arenaHeight = ARENA_HEIGHT + padding * 2;

        const screenAspect = window.innerWidth / window.innerHeight;
        const arenaAspect = arenaWidth / arenaHeight;

        let viewWidth, viewHeight;

        if (screenAspect > arenaAspect) {
            viewHeight = arenaHeight;
            viewWidth = arenaHeight * screenAspect;
        } else {
            viewWidth = arenaWidth;
            viewHeight = arenaWidth / screenAspect;
        }

        this.camera.left = -viewWidth / 2;
        this.camera.right = viewWidth / 2;
        this.camera.top = viewHeight / 2;
        this.camera.bottom = -viewHeight / 2;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const delta = this.clock.getDelta();

        // Update game logic
        if (this.game) {
            this.game.update(delta);
        }

        // Render scene
        this.renderer.render(this.scene, this.camera);
    }

    // Start solo test mode
    startSoloTest() {
        this.game.startSoloTest();
    }
}

// Start the game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.rpsArena = new RPSArena();
});
