class Storage {
    constructor() {
        this.STORAGE_KEY = 'kanban_encrypted_data';
        this.PASSWORD_HASH_KEY = 'kanban_password_hash';
        this.security = new Security();
    }

    async savePasswordHash(password) {
        const hash = await this.security.hashPassword(password);
        localStorage.setItem(this.PASSWORD_HASH_KEY, hash);
    }

    async verifyPassword(password) {
        const storedHash = localStorage.getItem(this.PASSWORD_HASH_KEY);
        if (!storedHash) return true; // Premier login
        
        const inputHash = await this.security.hashPassword(password);
        return inputHash === storedHash;
    }

    async saveCards(cards, password) {
        const encrypted = await this.security.encrypt(cards, password);
        localStorage.setItem(this.STORAGE_KEY, encrypted);
    }

    async loadCards(password) {
        const encrypted = localStorage.getItem(this.STORAGE_KEY);
        if (!encrypted) {
            return { todo: [], inprogress: [], done: [] };
        }
        
        return await this.security.decrypt(encrypted, password);
    }

    async exportData(cards, password) {
        return await this.security.encrypt(cards, password);
    }

    async importData(encryptedData, password) {
        return await this.security.decrypt(encryptedData, password);
    }

    hasData() {
        return localStorage.getItem(this.STORAGE_KEY) !== null;
    }

    clearAll() {
        localStorage.clear();
    }
}
