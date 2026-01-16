
import { createClient } from '@supabase/supabase-js';

// ------------------------------------------------------------------
// CONFIGURATION
// ------------------------------------------------------------------
const SUPABASE_URL = 'https://rnfuawkymhbamspbwchu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_6YzH8qwqVKIc7aS6RFlyAg_jcUr_pX_';

export let supabase = null;

try {
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
        supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
} catch (e) {
    console.warn('⚠️ Supabase init failed:', e);
}

// ------------------------------------------------------------------
// IDENTITY SERVICE (Auto-Auth)
// ------------------------------------------------------------------
export const IdentityService = {
    // Current Local User
    currentUser: null,

    async init() {
        if (!supabase) return null;

        const user = this.getOrCreateLocalIdentity();
        this.currentUser = user;

        // 3. Sync to DB (Upsert) - Don't await forever, do it in background
        this.syncUserToDB(this.currentUser).catch(e => console.error('Cloud Sync Failed:', e));

        return this.currentUser;
    },

    getOrCreateLocalIdentity() {
        // 1. Check LocalStorage
        let storedUser = null;
        try {
            const raw = localStorage.getItem('rps_user_identity');
            if (raw) storedUser = JSON.parse(raw);
        } catch (e) {
            console.warn('LocalStorage error:', e);
        }

        if (!storedUser) {
            // 2. Generate New Identity
            const uuid = (typeof crypto !== 'undefined' && crypto.randomUUID)
                ? crypto.randomUUID()
                : Math.random().toString(36).substring(2) + Date.now().toString(36);

            storedUser = {
                id: uuid,
                username: this.generateRandomUsername()
            };
            localStorage.setItem('rps_user_identity', JSON.stringify(storedUser));
        }

        this.currentUser = storedUser;
        return storedUser;
    },

    async syncUserToDB(user) {
        if (!supabase) return;

        try {
            await supabase
                .from('users')
                .upsert({
                    id: user.id,
                    username: user.username,
                    last_seen: new Date()
                });
        } catch (e) {
            console.warn('DB Sync Warning:', e.message);
        }
    },

    async updatePeerId(peerId) {
        if (!this.currentUser || !supabase) return;

        await supabase
            .from('users')
            .update({ peer_id: peerId, last_seen: new Date() })
            .eq('id', this.currentUser.id);
    },

    // ------------------------------------------------------------------
    // SOCIAL FEATURES
    // ------------------------------------------------------------------

    // Find friend by exact username
    async findUserByName(username) {
        if (!supabase) return null;
        const { data } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .single();
        return data; // Returns { id, username, peer_id }
    },

    // Send Invite
    async sendInvite(toUsername, partyId) {
        if (!supabase || !this.currentUser) return { error: 'Not connected' };

        const { error } = await supabase
            .from('invites')
            .insert({
                from_username: this.currentUser.username,
                to_username: toUsername,
                party_id: partyId,
                status: 'pending'
            });
        return { error };
    },

    // Check for incoming invites (Polling for simplicity)
    async checkInvites(callback) {
        if (!supabase || !this.currentUser) return;

        // Simple poll every 3s
        setInterval(async () => {
            const { data } = await supabase
                .from('invites')
                .select('*')
                .eq('to_username', this.currentUser.username)
                .eq('status', 'pending');

            if (data && data.length > 0) {
                // Determine new invites? For now just send all pending
                data.forEach(invite => callback(invite));
            }
        }, 3000);
    },

    async acceptInvite(inviteId) {
        if (!supabase) return;
        await supabase.from('invites').update({ status: 'accepted' }).eq('id', inviteId);
    },

    generateRandomUsername() {
        const adjectives = ['Cool', 'Super', 'Hyper', 'Neon', 'Cyber', 'Shadow', 'Mega', 'Ultra', 'Legendary', 'Fast', 'Brave', 'Apex'];
        const nouns = ['Soldier', 'Ninja', 'Raptor', 'Viper', 'Wolf', 'Titan', 'Ghost', 'Falcon', 'Knight', 'Warrior', 'Striker', 'Hero'];
        const num = Math.floor(Math.random() * 9999);
        return `${adjectives[Math.floor(Math.random() * adjectives.length)]}${nouns[Math.floor(Math.random() * nouns.length)]}${num}`;
    }
};
