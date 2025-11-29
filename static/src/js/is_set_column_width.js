/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { ListRenderer } from "@web/views/list/list_renderer";
import { useService } from "@web/core/utils/hooks";
import { useDebounced } from "@web/core/utils/timing";
import { onMounted, onPatched, onWillUnmount } from "@odoo/owl";

/**
 * Ce module patche le ListRenderer pour :
 * 1. Sauvegarder les largeurs de colonnes quand l'utilisateur les modifie
 * 2. Restaurer les largeurs sauvegardées au chargement de la vue
 * 
 * Les largeurs sont stockées dans le modèle is.set.column.width
 */

patch(ListRenderer.prototype, {
    setup() {
        super.setup(...arguments);
        
        // Service ORM pour communiquer avec le backend
        this.columnWidthOrm = useService("orm");
        
        // Clé de vue pour identifier cette liste de manière unique
        this.columnWidthViewKey = null;
        
        // Largeurs sauvegardées depuis la base de données
        this.savedColumnWidths = {};
        
        // Flag pour savoir si les préférences ont été chargées
        this.preferencesLoaded = false;
        
        // Debounce pour éviter trop d'appels au serveur lors du resize
        this.debouncedSaveColumnWidths = useDebounced(
            this._saveColumnWidthsToServer.bind(this), 
            800
        );
        
        // Wrapper pour intercepter les événements de fin de resize sur la fenêtre
        this._onResizeEnd = this._onResizeEnd.bind(this);
        
        // Charger les préférences sauvegardées au montage
        onMounted(async () => {
            this.columnWidthViewKey = this.createViewKey();
            await this._loadSavedColumnWidths();
            window.addEventListener("pointerup", this._onResizeEnd);
        });
        
        // Appliquer les largeurs après chaque patch (re-render)
        onPatched(() => {
            if (this.preferencesLoaded && Object.keys(this.savedColumnWidths).length > 0) {
                // Petit délai pour laisser le DOM se stabiliser
                setTimeout(() => this._applySavedColumnWidths(), 50);
            }
        });
        
        // Nettoyer les event listeners lors de la destruction
        onWillUnmount(() => {
            window.removeEventListener("pointerup", this._onResizeEnd);
        });
    },

    /**
     * Intercepte la fin du resize pour sauvegarder les largeurs
     */
    _onResizeEnd(ev) {
        if (!this.tableRef?.el) {
            return;
        }
        
        const table = this.tableRef.el;
        if (table.classList.contains("o_resizing")) {
            this.debouncedSaveColumnWidths();
        }
    },

    /**
     * Charge les largeurs de colonnes sauvegardées depuis le serveur
     */
    async _loadSavedColumnWidths() {
        if (!this.columnWidthViewKey) {
            return;
        }
        
        try {
            const widths = await this.columnWidthOrm.call(
                "is.set.column.width",
                "get_column_widths",
                [this.columnWidthViewKey]
            );
            if (widths && Object.keys(widths).length > 0) {
                this.savedColumnWidths = widths;
                this._applySavedColumnWidths();
            }
            this.preferencesLoaded = true;
        } catch (error) {
            console.warn("IsSetColumnWidth: Erreur lors du chargement des largeurs:", error);
            this.preferencesLoaded = true;
        }
    },

    /**
     * Applique les largeurs sauvegardées aux colonnes du tableau
     */
    _applySavedColumnWidths() {
        if (!this.tableRef?.el || !this.savedColumnWidths) {
            return;
        }
        
        const table = this.tableRef.el;
        const headers = [...table.querySelectorAll("thead th[data-name]")];
        
        if (headers.length === 0) {
            return;
        }
        
        let hasApplied = false;
        for (const th of headers) {
            const columnName = th.dataset.name;
            if (columnName && this.savedColumnWidths[columnName]) {
                th.style.width = `${this.savedColumnWidths[columnName]}px`;
                hasApplied = true;
            }
        }
        
        if (hasApplied) {
            table.style.tableLayout = "fixed";
        }
    },

    /**
     * Récupère les largeurs actuelles des colonnes depuis le DOM
     */
    _getCurrentColumnWidths() {
        if (!this.tableRef?.el) {
            return {};
        }
        
        const table = this.tableRef.el;
        const headers = [...table.querySelectorAll("thead th[data-name]")];
        const columnWidths = {};
        
        for (const th of headers) {
            const columnName = th.dataset.name;
            if (columnName) {
                const rect = th.getBoundingClientRect();
                if (rect.width > 0) {
                    columnWidths[columnName] = Math.round(rect.width);
                }
            }
        }
        
        return columnWidths;
    },

    /**
     * Sauvegarde les largeurs de colonnes sur le serveur
     */
    async _saveColumnWidthsToServer() {
        if (!this.columnWidthViewKey) {
            return;
        }
        
        const columnWidths = this._getCurrentColumnWidths();
        
        if (Object.keys(columnWidths).length === 0) {
            return;
        }
        
        this.savedColumnWidths = { ...this.savedColumnWidths, ...columnWidths };
        
        try {
            await this.columnWidthOrm.call(
                "is.set.column.width",
                "set_column_widths",
                [this.columnWidthViewKey, columnWidths]
            );
        } catch (error) {
            console.warn("IsSetColumnWidth: Erreur lors de la sauvegarde des largeurs:", error);
        }
    },
});
