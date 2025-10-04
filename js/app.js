// ========================================
// 🔐 GESTION DU CHIFFREMENT AES-256-GCM
// ========================================

class CryptoManager {
    constructor() {
        this.encoder = new TextEncoder();
        this.decoder = new TextDecoder();
    }

    async deriveKey(password, salt) {
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            this.encoder.encode(password),
            'PBKDF2',
            false,
            ['deriveBits', 'deriveKey']
        );

        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }

    async encrypt(data, password) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await this.deriveKey(password, salt);

        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            this.encoder.encode(JSON.stringify(data))
        );

        return {
            salt: Array.from(salt),
            iv: Array.from(iv),
            data: Array.from(new Uint8Array(encrypted))
        };
    }

    async decrypt(encryptedData, password) {
        try {
            const salt = new Uint8Array(encryptedData.salt);
            const iv = new Uint8Array(encryptedData.iv);
            const data = new Uint8Array(encryptedData.data);
            const key = await this.deriveKey(password, salt);

            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                data
            );

            return JSON.parse(this.decoder.decode(decrypted));
        } catch (error) {
            throw new Error('Mot de passe incorrect');
        }
    }
}

// ========================================
// 📊 APPLICATION KANBAN
// ========================================

class KanbanApp {
    constructor() {
        this.cryptoManager = new CryptoManager();
        this.currentPassword = null;
        this.cards = [];
        this.draggedCard = null;
        
        this.init();
    }

    init() {
        this.setupLoginScreen();
        this.setupAppScreen();
        this.setupModals();
        this.setupDragAndDrop();
    }

    // ========================================
    // 🔒 ÉCRAN DE CONNEXION
    // ========================================

    setupLoginScreen() {
        const loginForm = document.getElementById('loginForm');
        const passwordInput = document.getElementById('passwordInput');
        const toggleBtn = document.getElementById('toggleLoginPassword');
        const loginError = document.getElementById('loginError');

        // Bouton afficher/masquer mot de passe
        toggleBtn.addEventListener('click', () => {
            const type = passwordInput.type === 'password' ? 'text' : 'password';
            passwordInput.type = type;
            toggleBtn.textContent = type === 'password' ? '👁️' : '🙈';
        });

        // Soumission du formulaire
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = passwordInput.value;

            if (password.length < 8) {
                this.showError(loginError, 'Le mot de passe doit contenir au moins 8 caractères');
                return;
            }

            try {
                await this.login(password);
                loginError.style.display = 'none';
                passwordInput.value = '';
                this.showApp();
            } catch (error) {
                this.showError(loginError, error.message);
            }
        });
    }

    async login(password) {
        const encryptedData = localStorage.getItem('kanbanData');

        if (!encryptedData) {
            // Premier lancement : créer nouveau mot de passe
            this.currentPassword = password;
            await this.saveData();
            this.showNotification('✅ Mot de passe créé avec succès !', 'success');
        } else {
            // Connexion : déchiffrer les données
            const encrypted = JSON.parse(encryptedData);
            this.cards = await this.cryptoManager.decrypt(encrypted, password);
            this.currentPassword = password;
        }
    }

    showApp() {
        document.getElementById('loginScreen').classList.remove('active');
        document.getElementById('appScreen').classList.add('active');
        this.renderCards();
    }

    // ========================================
    // 📊 ÉCRAN PRINCIPAL
    // ========================================

    setupAppScreen() {
        // Bouton ajouter carte
        document.getElementById('addCardBtn').addEventListener('click', () => {
            this.openCardModal();
        });

        // Bouton import/export
        document.getElementById('importExportBtn').addEventListener('click', () => {
            this.openImportExportModal();
        });

        // Bouton changer mot de passe
        document.getElementById('changePasswordBtn').addEventListener('click', () => {
            this.openChangePasswordModal();
        });

        // Bouton verrouiller
        document.getElementById('lockBtn').addEventListener('click', () => {
            this.lock();
        });
    }

    lock() {
        this.currentPassword = null;
        this.cards = [];
        document.getElementById('appScreen').classList.remove('active');
        document.getElementById('loginScreen').classList.add('active');
        this.clearCards();
        this.showNotification('🔒 Application verrouillée', 'info');
    }

    // ========================================
    // 🎴 GESTION DES CARTES
    // ========================================

    renderCards() {
        // Vider les colonnes
        document.getElementById('todoCards').innerHTML = '';
        document.getElementById('doingCards').innerHTML = '';
        document.getElementById('doneCards').innerHTML = '';

        // Compter les cartes
        const counts = { todo: 0, doing: 0, done: 0 };

        // Afficher chaque carte
        this.cards.forEach(card => {
            this.renderCard(card);
            counts[card.status]++;
        });

        // Mettre à jour les compteurs
        document.getElementById('todoCount').textContent = counts.todo;
        document.getElementById('doingCount').textContent = counts.doing;
        document.getElementById('doneCount').textContent = counts.done;
    }

    renderCard(card) {
        const container = document.getElementById(`${card.status}Cards`);
        const cardElement = document.createElement('div');
        cardElement.className = 'card';
        cardElement.draggable = true;
        cardElement.dataset.id = card.id;

        // Troncature description (2 lignes max)
        const shortDescription = this.truncateText(card.description, 100);

        // Date d'échéance avec couleur
        let dueDateHtml = '';
        if (card.dueDate) {
            const dueClass = this.getDueDateClass(card.dueDate);
            const formattedDate = this.formatDate(card.dueDate);
            dueDateHtml = `<div class="card-due-date ${dueClass}">📅 ${formattedDate}</div>`;
        }

        cardElement.innerHTML = `
            <div class="card-header">
                <h3 class="card-title">${this.escapeHtml(card.title)}</h3>
            </div>
            ${card.description ? `<p class="card-description">${this.escapeHtml(shortDescription)}</p>` : ''}
            ${dueDateHtml}
        `;

        // Clic sur la carte = ouvrir détails
        cardElement.addEventListener('click', () => {
            this.openDetailsModal(card.id);
        });

        // Drag & Drop
        cardElement.addEventListener('dragstart', (e) => {
            this.draggedCard = card.id;
            cardElement.classList.add('dragging');
        });

        cardElement.addEventListener('dragend', () => {
            cardElement.classList.remove('dragging');
        });

        container.appendChild(cardElement);
    }

    truncateText(text, maxLength) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    getDueDateClass(dueDate) {
        const due = new Date(dueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const diffTime = due - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return 'overdue'; // Passé = rouge
        if (diffDays <= 2) return 'soon'; // Dans 2 jours = orange
        return 'normal'; // Sinon normal
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-FR', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric' 
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    clearCards() {
        document.getElementById('todoCards').innerHTML = '';
        document.getElementById('doingCards').innerHTML = '';
        document.getElementById('doneCards').innerHTML = '';
        document.getElementById('todoCount').textContent = '0';
        document.getElementById('doingCount').textContent = '0';
        document.getElementById('doneCount').textContent = '0';
    }

    // ========================================
    // 🖱️ DRAG & DROP
    // ========================================

    setupDragAndDrop() {
        const containers = document.querySelectorAll('.cards-container');

        containers.forEach(container => {
            container.addEventListener('dragover', (e) => {
                e.preventDefault();
                container.classList.add('drag-over');
            });

            container.addEventListener('dragleave', () => {
                container.classList.remove('drag-over');
            });

            container.addEventListener('drop', (e) => {
                e.preventDefault();
                container.classList.remove('drag-over');

                const newStatus = container.id.replace('Cards', '');
                this.moveCard(this.draggedCard, newStatus);
            });
        });
    }

    async moveCard(cardId, newStatus) {
        const card = this.cards.find(c => c.id === cardId);
        if (!card || card.status === newStatus) return;

        card.status = newStatus;
        card.updatedAt = new Date().toISOString();

        await this.saveData();
        this.renderCards();
        this.showNotification('✅ Carte déplacée', 'success');
    }

    // ========================================
    // ➕ MODAL AJOUT/MODIFICATION CARTE
    // ========================================

    setupModals() {
        this.setupCardModal();
        this.setupDetailsModal();
        this.setupImportExportModal();
        this.setupChangePasswordModal();
    }

    setupCardModal() {
        const modal = document.getElementById('cardModal');
        const form = document.getElementById('cardForm');
        const closeBtn = document.getElementById('closeCardModal');
        const cancelBtn = document.getElementById('cancelCardBtn');

        closeBtn.addEventListener('click', () => this.closeModal(modal));
        cancelBtn.addEventListener('click', () => this.closeModal(modal));

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveCard();
        });

        // Fermer si clic en dehors
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeModal(modal);
        });
    }

    openCardModal(cardId = null) {
        const modal = document.getElementById('cardModal');
        const title = document.getElementById('cardModalTitle');
        const form = document.getElementById('cardForm');

        form.reset();
        document.getElementById('editCardId').value = '';

        if (cardId) {
            // Mode édition
            const card = this.cards.find(c => c.id === cardId);
            if (!card) return;

            title.textContent = '✏️ Modifier la carte';
            document.getElementById('editCardId').value = card.id;
            document.getElementById('cardTitle').value = card.title;
            document.getElementById('cardDescription').value = card.description || '';
            document.getElementById('cardStatus').value = card.status;
            document.getElementById('cardDueDate').value = card.dueDate || '';
        } else {
            // Mode création
            title.textContent = '➕ Nouvelle carte';
            document.getElementById('cardStatus').value = 'todo';
        }

        modal.classList.add('active');
    }

    async saveCard() {
        const cardId = document.getElementById('editCardId').value;
        const title = document.getElementById('cardTitle').value.trim();
        const description = document.getElementById('cardDescription').value.trim();
        const status = document.getElementById('cardStatus').value;
        const dueDate = document.getElementById('cardDueDate').value;

        if (!title) {
            this.showNotification('❌ Le titre est obligatoire', 'error');
            return;
        }

        if (cardId) {
            // Modification
            const card = this.cards.find(c => c.id === cardId);
            if (card) {
                card.title = title;
                card.description = description;
                card.status = status;
                card.dueDate = dueDate;
                card.updatedAt = new Date().toISOString();
            }
        } else {
            // Création
            const newCard = {
                id: this.generateId(),
                title,
                description,
                status,
                dueDate,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            this.cards.push(newCard);
        }

        await this.saveData();
        this.renderCards();
        this.closeModal(document.getElementById('cardModal'));
        this.showNotification('✅ Carte enregistrée', 'success');
    }

    // ========================================
    // 🔍 MODAL DÉTAILS CARTE
    // ========================================

    setupDetailsModal() {
        const modal = document.getElementById('detailsModal');
        const closeBtn = document.getElementById('closeDetailsModal');
        const editBtn = document.getElementById('editCardFromDetailsBtn');
        const deleteBtn = document.getElementById('deleteCardFromDetailsBtn');

        closeBtn.addEventListener('click', () => this.closeModal(modal));

        editBtn.addEventListener('click', () => {
            const cardId = editBtn.dataset.cardId;
            this.closeModal(modal);
            this.openCardModal(cardId);
        });

        deleteBtn.addEventListener('click', async () => {
            const cardId = deleteBtn.dataset.cardId;
            if (confirm('❌ Supprimer cette carte ?')) {
                await this.deleteCard(cardId);
                this.closeModal(modal);
            }
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeModal(modal);
        });
    }

    openDetailsModal(cardId) {
        const card = this.cards.find(c => c.id === cardId);
        if (!card) return;

        const modal = document.getElementById('detailsModal');

        // Remplir les champs
        document.getElementById('detailsCardTitle').textContent = card.title;
        document.getElementById('detailsCardDescription').textContent = card.description || 'Aucune description';
        
        // Date d'échéance
        if (card.dueDate) {
            const dueClass = this.getDueDateClass(card.dueDate);
            const formattedDate = this.formatDate(card.dueDate);
            document.getElementById('detailsCardDueDate').innerHTML = `<span class="due-date-badge ${dueClass}">📅 ${formattedDate}</span>`;
        } else {
            document.getElementById('detailsCardDueDate').textContent = 'Aucune échéance';
        }

        // Métadonnées
        document.getElementById('detailsCreatedDate').textContent = this.formatDateTime(card.createdAt);
        document.getElementById('detailsModifiedDate').textContent = this.formatDateTime(card.updatedAt);
        document.getElementById('detailsColumn').textContent = this.getStatusLabel(card.status);
        document.getElementById('detailsLifetime').textContent = this.calculateLifetime(card.createdAt);

        // Stocker l'ID pour les boutons
        document.getElementById('editCardFromDetailsBtn').dataset.cardId = card.id;
        document.getElementById('deleteCardFromDetailsBtn').dataset.cardId = card.id;

        modal.classList.add('active');
    }

    getStatusLabel(status) {
        const labels = {
            todo: '📝 À faire',
            doing: '⚙️ En cours',
            done: '✅ Terminé'
        };
        return labels[status] || status;
    }

    formatDateTime(isoString) {
        const date = new Date(isoString);
        return date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    calculateLifetime(createdAt) {
        const created = new Date(createdAt);
        const now = new Date();
        const diffMs = now - created;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

        if (diffDays === 0) return `${diffHours}h`;
        return `${diffDays}j ${diffHours}h`;
    }

    async deleteCard(cardId) {
        this.cards = this.cards.filter(c => c.id !== cardId);
        await this.saveData();
        this.renderCards();
        this.showNotification('✅ Carte supprimée', 'success');
    }

    // ========================================
    // 📥 MODAL IMPORT/EXPORT
    // ========================================

    setupImportExportModal() {
        const modal = document.getElementById('importExportModal');
        const closeBtn = document.getElementById('closeImportExportModal');
        const exportBtn = document.getElementById('exportCardsBtn');
        const importFileInput = document.getElementById('importFileInput');
        const importBtn = document.getElementById('importCardsBtn');

        closeBtn.addEventListener('click', () => this.closeModal(modal));

        exportBtn.addEventListener('click', () => this.exportCards());

        importFileInput.addEventListener('change', () => {
            importBtn.disabled = !importFileInput.files.length;
        });

        importBtn.addEventListener('click', async () => {
            await this.importCards(importFileInput.files[0]);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeModal(modal);
        });
    }

    openImportExportModal() {
        const modal = document.getElementById('importExportModal');
        document.getElementById('importFileInput').value = '';
        document.getElementById('importCardsBtn').disabled = true;
        modal.classList.add('active');
    }

    exportCards() {
        const dataStr = JSON.stringify(this.cards, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kanban-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showNotification('✅ Export réussi', 'success');
    }

    async importCards(file) {
        if (!file) return;

        try {
            const text = await file.text();
            const importedCards = JSON.parse(text);

            if (!Array.isArray(importedCards)) {
                throw new Error('Format invalide');
            }

            this.cards = importedCards;
            await this.saveData();
            this.renderCards();
            this.closeModal(document.getElementById('importExportModal'));
            this.showNotification('✅ Import réussi', 'success');
        } catch (error) {
            this.showNotification('❌ Erreur lors de l\'import', 'error');
        }
    }

    // ========================================
    // 🔑 MODAL CHANGEMENT MOT DE PASSE
    // ========================================

    setupChangePasswordModal() {
        const modal = document.getElementById('changePasswordModal');
        const form = document.getElementById('changePasswordForm');
        const closeBtn = document.getElementById('closeChangePasswordModal');
        const cancelBtn = document.getElementById('cancelChangePasswordBtn');
        const errorDiv = document.getElementById('changePasswordError');

        closeBtn.addEventListener('click', () => this.closeModal(modal));
        cancelBtn.addEventListener('click', () => this.closeModal(modal));

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.changePassword(errorDiv);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeModal(modal);
        });
    }

    openChangePasswordModal() {
        const modal = document.getElementById('changePasswordModal');
        document.getElementById('changePasswordForm').reset();
        document.getElementById('changePasswordError').style.display = 'none';
        modal.classList.add('active');
    }

    async changePassword(errorDiv) {
        const currentPwd = document.getElementById('currentPasswordInput').value;
        const newPwd = document.getElementById('newPasswordInput').value;
        const confirmPwd = document.getElementById('confirmPasswordInput').value;

        // Vérifications
        if (currentPwd !== this.currentPassword) {
            this.showError(errorDiv, 'Mot de passe actuel incorrect');
            return;
        }

        if (newPwd.length < 8) {
            this.showError(errorDiv, 'Le nouveau mot de passe doit contenir au moins 8 caractères');
            return;
        }

        if (newPwd !== confirmPwd) {
            this.showError(errorDiv, 'Les mots de passe ne correspondent pas');
            return;
        }

        // Changer le mot de passe
        this.currentPassword = newPwd;
        await this.saveData();

        this.closeModal(document.getElementById('changePasswordModal'));
        this.showNotification('✅ Mot de passe changé avec succès', 'success');
    }

    // ========================================
    // 💾 SAUVEGARDE / CHARGEMENT
    // ========================================

    async saveData() {
        const encrypted = await this.cryptoManager.encrypt(this.cards, this.currentPassword);
        localStorage.setItem('kanbanData', JSON.stringify(encrypted));
    }

    // ========================================
    // 🛠️ UTILITAIRES
    // ========================================

    closeModal(modal) {
        modal.classList.remove('active');
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    showError(element, message) {
        element.textContent = message;
        element.style.display = 'block';
        setTimeout(() => {
            element.style.display = 'none';
        }, 5000);
    }

    showNotification(message, type = 'info') {
        // Créer notification toast
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('show');
        }, 100);

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// ========================================
// 🚀 INITIALISATION
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    new KanbanApp();
});
