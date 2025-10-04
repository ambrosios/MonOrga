class TrelloClone {
    constructor() {
        this.cards = this.loadCards();
        this.currentEditingCard = null;
        this.currentColumn = null;
        this.init();
    }

    init() {
        this.renderAllCards();
        this.attachEventListeners();
        this.updateCardCounts();
    }

    // Gestion du localStorage
    loadCards() {
        const stored = localStorage.getItem('trelloCards');
        return stored ? JSON.parse(stored) : {
            todo: [],
            inprogress: [],
            done: []
        };
    }

    saveCards() {
        localStorage.setItem('trelloCards', JSON.stringify(this.cards));
    }

    // Génération d'ID unique
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Vérification de date d'échéance
    isOverdue(dueDate) {
        if (!dueDate) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(dueDate);
        return due < today;
    }

    // Formatage de date
    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    }

    // Rendu d'une carte
    createCardElement(card, columnId) {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card';
        cardDiv.draggable = true;
        cardDiv.dataset.cardId = card.id;
        cardDiv.dataset.column = columnId;

        const dueDateHTML = card.dueDate ? `
            <div class="card-due-date ${this.isOverdue(card.dueDate) ? 'overdue' : ''}">
                ${this.formatDate(card.dueDate)}
            </div>
        ` : '';

        const descriptionHTML = card.description ? `
            <div class="card-description">${this.escapeHtml(card.description)}</div>
        ` : '';

        cardDiv.innerHTML = `
            <div class="card-header">
                <div class="card-title">${this.escapeHtml(card.title)}</div>
                <div class="card-actions">
                    <button class="card-btn edit-btn" data-action="edit">✏️</button>
                    <button class="card-btn delete-btn" data-action="delete">🗑️</button>
                </div>
            </div>
            ${descriptionHTML}
            ${dueDateHTML}
        `;

        this.attachCardEventListeners(cardDiv, card, columnId);
        return cardDiv;
    }

    // Échappement HTML pour sécurité
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Rendu de toutes les cartes
    renderAllCards() {
        Object.keys(this.cards).forEach(columnId => {
            this.renderColumn(columnId);
        });
    }

    // Rendu d'une colonne
    renderColumn(columnId) {
        const container = document.querySelector(`[data-column-id="${columnId}"]`);
        container.innerHTML = '';
        
        this.cards[columnId].forEach(card => {
            const cardElement = this.createCardElement(card, columnId);
            container.appendChild(cardElement);
        });
    }

    // Mise à jour des compteurs
    updateCardCounts() {
        Object.keys(this.cards).forEach(columnId => {
            const count = this.cards[columnId].length;
            const column = document.querySelector(`[data-column="${columnId}"]`);
            const countSpan = column.querySelector('.card-count');
            countSpan.textContent = count;
        });
    }

    // Gestion des événements
    attachEventListeners() {
        // Boutons d'ajout de carte
        document.querySelectorAll('.add-card-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.currentColumn = e.target.dataset.column;
                this.currentEditingCard = null;
                this.openModal();
            });
        });

        // Modal
        const modal = document.getElementById('cardModal');
        const closeBtn = document.querySelector('.close');
        const cancelBtn = document.getElementById('cancelBtn');
        const form = document.getElementById('cardForm');

        closeBtn.addEventListener('click', () => this.closeModal());
        cancelBtn.addEventListener('click', () => this.closeModal());
        
        window.addEventListener('click', (e) => {
            if (e.target === modal) this.closeModal();
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveCard();
        });

        // Drag and Drop
        this.attachDragAndDropListeners();
    }

    // Événements spécifiques à une carte
    attachCardEventListeners(cardElement, card, columnId) {
        // Boutons Edit et Delete
        cardElement.querySelector('[data-action="edit"]').addEventListener('click', (e) => {
            e.stopPropagation();
            this.editCard(card, columnId);
        });

        cardElement.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteCard(card.id, columnId);
        });

        // Drag events
        cardElement.addEventListener('dragstart', (e) => {
            cardElement.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', cardElement.innerHTML);
            e.dataTransfer.setData('cardId', card.id);
            e.dataTransfer.setData('sourceColumn', columnId);
        });

        cardElement.addEventListener('dragend', () => {
            cardElement.classList.remove('dragging');
        });
    }

    // Drag and Drop
    attachDragAndDropListeners() {
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

                const cardId = e.dataTransfer.getData('cardId');
                const sourceColumn = e.dataTransfer.getData('sourceColumn');
                const targetColumn = container.dataset.columnId;

                this.moveCard(cardId, sourceColumn, targetColumn);
            });
        });
    }

    // Déplacement de carte
    moveCard(cardId, sourceColumn, targetColumn) {
        if (sourceColumn === targetColumn) return;

        const cardIndex = this.cards[sourceColumn].findIndex(c => c.id === cardId);
        if (cardIndex === -1) return;

        const [card] = this.cards[sourceColumn].splice(cardIndex, 1);
        this.cards[targetColumn].push(card);

        this.saveCards();
        this.renderColumn(sourceColumn);
        this.renderColumn(targetColumn);
        this.updateCardCounts();
    }

    // Gestion du modal
    openModal() {
        const modal = document.getElementById('cardModal');
        const form = document.getElementById('cardForm');
        const modalTitle = document.getElementById('modalTitle');

        if (this.currentEditingCard) {
            modalTitle.textContent = 'Modifier la carte';
            document.getElementById('cardTitle').value = this.currentEditingCard.title;
            document.getElementById('cardDescription').value = this.currentEditingCard.description || '';
            document.getElementById('cardDueDate').value = this.currentEditingCard.dueDate || '';
        } else {
            modalTitle.textContent = 'Nouvelle carte';
            form.reset();
        }

        modal.classList.add('active');
    }

    closeModal() {
        const modal = document.getElementById('cardModal');
        modal.classList.remove('active');
        document.getElementById('cardForm').reset();
        this.currentEditingCard = null;
        this.currentColumn = null;
    }

    // Sauvegarde de carte
    saveCard() {
        const title = document.getElementById('cardTitle').value.trim();
        const description = document.getElementById('cardDescription').value.trim();
        const dueDate = document.getElementById('cardDueDate').value;

        if (!title) return;

        if (this.currentEditingCard) {
            // Modification
            const card = this.cards[this.currentColumn].find(c => c.id === this.currentEditingCard.id);
            if (card) {
                card.title = title;
                card.description = description;
                card.dueDate = dueDate;
            }
        } else {
            // Création
            const newCard = {
                id: this.generateId(),
                title,
                description,
                dueDate,
                createdAt: new Date().toISOString()
            };
            this.cards[this.currentColumn].push(newCard);
        }

        this.saveCards();
        this.renderColumn(this.currentColumn);
        this.updateCardCounts();
        this.closeModal();
    }

    // Édition de carte
    editCard(card, columnId) {
        this.currentEditingCard = card;
        this.currentColumn = columnId;
        this.openModal();
    }

    // Suppression de carte
    deleteCard(cardId, columnId) {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cette carte ?')) return;

        this.cards[columnId] = this.cards[columnId].filter(c => c.id !== cardId);
        this.saveCards();
        this.renderColumn(columnId);
        this.updateCardCounts();
    }
}

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    new TrelloClone();
});
