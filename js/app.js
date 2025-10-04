class KanbanApp {
    constructor() {
        this.storage = new Storage();
        this.ui = new UI();
        this.masterPassword = null;
        this.cards = { todo: [], inprogress: [], done: [] };
        this.draggedCard = null;
        
        this.init();
    }

    init() {
        this.setupLoginForm();
    }

    setupLoginForm() {
        const loginForm = document.getElementById('loginForm');
        const togglePassword = document.getElementById('toggleLoginPassword');
        const passwordInput = document.getElementById('masterPassword');

        togglePassword.addEventListener('click', () => {
            const type = passwordInput.type === 'password' ? 'text' : 'password';
            passwordInput.type = type;
            togglePassword.textContent = type === 'password' ? '👁️' : '🙈';
        });

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleLogin();
        });
    }

    async handleLogin() {
        const password = document.getElementById('masterPassword').value;
        
        try {
            const isValid = await this.storage.verifyPassword(password);
            
            if (!isValid) {
                this.ui.showError('Mot de passe incorrect');
                return;
            }

            this.masterPassword = password;

            if (!this.storage.hasData()) {
                await this.storage.savePasswordHash(password);
                await this.storage.saveCards(this.cards, password);
            } else {
                this.cards = await this.storage.loadCards(password);
            }

            this.showKanbanScreen();
            this.ui.renderAllColumns(this.cards);
            this.setupKanbanEvents();
            
        } catch (error) {
            this.ui.showError('Erreur de connexion');
            console.error(error);
        }
    }

    showKanbanScreen() {
        document.getElementById('loginScreen').classList.remove('active');
        document.getElementById('kanbanScreen').classList.add('active');
    }

    setupKanbanEvents() {
        // Boutons d'ajout de carte
        document.querySelectorAll('.btn-add-card').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const columnId = e.target.dataset.column;
                this.ui.openModal(columnId, null, this.saveCard.bind(this));
            });
        });

        // Drag & drop
        this.setupDragAndDrop();

        // Suppression de carte
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-delete')) {
                const cardId = e.target.dataset.cardId;
                const columnId = e.target.dataset.columnId;
                this.deleteCard(columnId, cardId);
            }
        });

        // Édition de carte
        document.addEventListener('dblclick', (e) => {
            const card = e.target.closest('.card');
            if (card) {
                const cardId = card.dataset.cardId;
                const columnId = card.dataset.columnId;
                const cardData = this.cards[columnId].find(c => c.id === cardId);
                this.ui.openModal(columnId, cardData, this.saveCard.bind(this));
            }
        });

        // Déconnexion
        document.getElementById('logoutBtn').addEventListener('click', () => {
            location.reload();
        });

        // Export/Import
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.handleExport();
        });
        
        document.getElementById('importBtn').addEventListener('click', () => {
            document.getElementById('importFile').click();
        });
        
        document.getElementById('importFile').addEventListener('change', (e) => {
            this.handleImport(e);
        });
    }

    setupDragAndDrop() {
        document.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('card')) {
                this.draggedCard = {
                    element: e.target,
                    id: e.target.dataset.cardId,
                    fromColumn: e.target.dataset.columnId
                };
                e.target.classList.add('dragging');
            }
        });

        document.addEventListener('dragend', (e) => {
            if (e.target.classList.contains('card')) {
                e.target.classList.remove('dragging');
            }
        });

        document.querySelectorAll('.column-content').forEach(column => {
            column.addEventListener('dragover', (e) => {
                e.preventDefault();
                column.classList.add('drag-over');
            });

            column.addEventListener('dragleave', () => {
                column.classList.remove('drag-over');
            });

            column.addEventListener('drop', async (e) => {
                e.preventDefault();
                column.classList.remove('drag-over');

                if (!this.draggedCard) return;

                const toColumn = column.id.replace('-cards', '');
                const fromColumn = this.draggedCard.fromColumn;
                const cardId = this.draggedCard.id;

                if (fromColumn !== toColumn) {
                    await this.moveCard(fromColumn, toColumn, cardId);
                }

                this.draggedCard = null;
            });
        });
    }

    async saveCard(columnId, cardData, existingCardId = null) {
        if (existingCardId) {
            const index = this.cards[columnId].findIndex(c => c.id === existingCardId);
            if (index !== -1) {
                this.cards[columnId][index] = cardData;
            }
        } else {
            this.cards[columnId].push(cardData);
        }

        await this.saveAndRender();
        this.ui.showSuccess('Carte enregistrée');
    }

    async deleteCard(columnId, cardId) {
        if (!confirm('Supprimer cette carte ?')) return;

        this.cards[columnId] = this.cards[columnId].filter(c => c.id !== cardId);
        await this.saveAndRender();
        this.ui.showSuccess('Carte supprimée');
    }

    async moveCard(fromColumn, toColumn, cardId) {
        const cardIndex = this.cards[fromColumn].findIndex(c => c.id === cardId);
        if (cardIndex === -1) return;

        const card = this.cards[fromColumn][cardIndex];
        this.cards[fromColumn].splice(cardIndex, 1);
        this.cards[toColumn].push(card);

        await this.saveAndRender();
    }

    async handleExport() {
        try {
            const encrypted = await this.storage.exportData(this.cards, this.masterPassword);
            const blob = new Blob([encrypted], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `kanban-backup-${Date.now()}.enc`;
            a.click();
            URL.revokeObjectURL(url);
            this.ui.showSuccess('Export réussi');
        } catch (error) {
            this.ui.showError('Erreur lors de l\'export');
        }
    }

    async handleImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const encrypted = e.target.result;
                const cards = await this.storage.importData(encrypted, this.masterPassword);
                this.cards = cards;
                await this.saveAndRender();
                this.ui.showSuccess('Import réussi !');
            } catch (error) {
                this.ui.showError(error.message);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    async saveAndRender() {
        try {
            await this.storage.saveCards(this.cards, this.masterPassword);
            this.ui.renderAllColumns(this.cards);
        } catch (error) {
            this.ui.showError('Erreur lors de la sauvegarde');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new KanbanApp();
});
