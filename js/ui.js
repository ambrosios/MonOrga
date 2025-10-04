class UI {
    constructor() {
        this.modal = document.getElementById('cardModal');
        this.closeBtn = document.querySelector('.close');
        this.cancelBtn = document.getElementById('cancelCard');
        this.notificationContainer = document.getElementById('notificationContainer');
        
        this.setupModalListeners();
    }

    setupModalListeners() {
        this.closeBtn.onclick = () => this.closeModal();
        this.cancelBtn.onclick = () => this.closeModal();
        
        window.onclick = (e) => {
            if (e.target === this.modal) {
                this.closeModal();
            }
        };
    }

    openModal(columnId, card = null, onSave) {
        const form = document.getElementById('cardForm');
        const modalTitle = document.getElementById('modalTitle');
        
        modalTitle.textContent = card ? '✏️ Modifier la carte' : '➕ Nouvelle carte';
        
        document.getElementById('cardTitle').value = card?.title || '';
        document.getElementById('cardDescription').value = card?.description || '';
        
        form.onsubmit = async (e) => {
            e.preventDefault();
            
            const cardData = {
                id: card?.id || Date.now().toString(),
                title: document.getElementById('cardTitle').value.trim(),
                description: document.getElementById('cardDescription').value.trim(),
                createdAt: card?.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            await onSave(columnId, cardData, card?.id);
            this.closeModal();
            form.reset();
        };
        
        this.modal.style.display = 'block';
        document.getElementById('cardTitle').focus();
    }

    closeModal() {
        this.modal.style.display = 'none';
        document.getElementById('cardForm').reset();
    }

    renderAllColumns(cards) {
        ['todo', 'inprogress', 'done'].forEach(columnId => {
            this.renderColumn(columnId, cards[columnId] || []);
            this.updateColumnCount(columnId, (cards[columnId] || []).length);
        });
    }

    renderColumn(columnId, columnCards) {
        const container = document.getElementById(`${columnId}-cards`);
        if (!container) return;
        
        container.innerHTML = '';
        
        columnCards.forEach(card => {
            const cardElement = this.createCardElement(card, columnId);
            container.appendChild(cardElement);
        });
    }

    createCardElement(card, columnId) {
        const div = document.createElement('div');
        div.className = 'card';
        div.draggable = true;
        div.dataset.cardId = card.id;
        div.dataset.columnId = columnId;
        
        const date = new Date(card.updatedAt);
        const formattedDate = date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        div.innerHTML = `
            <div class="card-header">
                <h3 class="card-title">${this.escapeHtml(card.title)}</h3>
                <button class="btn-delete" data-card-id="${card.id}" data-column-id="${columnId}">
                    🗑️
                </button>
            </div>
            
            ${card.description ? `
                <div class="card-description">
                    ${this.escapeHtml(card.description)}
                </div>
            ` : ''}
            
            <div class="card-metadata">
                <div class="metadata-item">
                    <span class="metadata-label">📅 Modifié:</span>
                    <span class="metadata-value">${formattedDate}</span>
                </div>
            </div>
        `;
        
        return div;
    }

    updateColumnCount(columnId, count) {
        const column = document.querySelector(`[data-column="${columnId}"]`);
        if (column) {
            const countElement = column.querySelector('.column-count');
            if (countElement) {
                countElement.textContent = count;
            }
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        this.notificationContainer.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }
}
