
import { IdentityService } from '../services/SupabaseClient.js';

export class IdentityUI {
    constructor(app) {
        this.app = app;
        this.currentUser = null;
        this.processedInvites = new Set();

        // Remove Auth Screen if it exists (Cleanup)
        const authScreen = document.getElementById('auth-screen');
        if (authScreen) authScreen.remove();

        // Ensure Main Menu is visible
        const mainMenu = document.getElementById('main-menu');
        if (mainMenu) mainMenu.classList.remove('hidden');

        this.init();
    }

    async init() {
        // 1. Initialize Identity (Auto-Login)
        this.currentUser = await IdentityService.init();

        if (this.currentUser) {
            this.updateProfileDisplay();
            this.startInviteListener();
            this.setupSocialListeners();
        }
    }

    setupSocialListeners() {
        const btnSend = document.getElementById('btn-send-invite');
        const inputUsername = document.getElementById('invite-username');

        btnSend?.addEventListener('click', async () => {
            const targetUsername = inputUsername.value.trim();
            if (!targetUsername) return alert('Please enter a username');
            if (targetUsername === this.currentUser.username) return alert('You cannot invite yourself!');

            if (!this.app.network.partyId) return alert('You must create a party first!');

            btnSend.disabled = true;
            btnSend.textContent = 'Sending...';

            const { error } = await IdentityService.sendInvite(targetUsername, this.app.network.partyId);

            if (error) {
                alert('Failed to send invite: ' + error);
            } else {
                alert(`Invite sent to ${targetUsername}!`);
                inputUsername.value = '';
            }

            btnSend.disabled = false;
            btnSend.textContent = 'Invite Friend 📩';
        });
    }

    updateProfileDisplay() {
        const nameDisplay = document.getElementById('user-display-name');
        if (nameDisplay && this.currentUser) {
            nameDisplay.textContent = this.currentUser.username;
        }

        console.log('👤 Player Identity:', this.currentUser?.username || 'Guest');
    }

    startInviteListener() {
        if (!IdentityService.currentUser) return;

        IdentityService.checkInvites((invite) => {
            if (this.processedInvites.has(invite.id)) return;
            this.processedInvites.add(invite.id);

            // Show Invite Popup
            const accept = confirm(`📩 Invite from ${invite.from_username}! Join Party?`);
            if (accept) {
                IdentityService.acceptInvite(invite.id);
                this.app.network.joinParty(invite.party_id);
            }
        });
    }
}
