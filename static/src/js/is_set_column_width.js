/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { ListRenderer } from "@web/views/list/list_renderer";
import { useService } from "@web/core/utils/hooks";
import { useDebounced } from "@web/core/utils/timing";
import { onMounted, onWillUnmount, useEffect, onWillStart } from "@odoo/owl";

/**
 * Ce module patche le ListRenderer pour :
 * 1. Sauvegarder les largeurs de colonnes quand l'utilisateur les modifie
 * 2. Restaurer les largeurs sauvegardées au chargement de la vue AVANT le premier rendu visible
 * 
 * Les largeurs sont stockées dans le modèle is.set.column.width
 * 
 * STRATÉGIE pour éviter le clignotement :
 * - On précharge les largeurs dans onWillStart (avant le premier rendu)
 * - On injecte du CSS avec !important pour bloquer le recalcul par Odoo
 * - On désactive temporairement le CSS pendant le redimensionnement manuel
 * - Après le redimensionnement, on réinjecte le CSS avec les nouvelles largeurs
 */

// Cache global pour stocker les largeurs par viewKey
const columnWidthsCache = {};

// Set pour suivre les vues en cours de chargement
const loadingViews = new Set();

// Compteur pour générer des IDs uniques de table
let tableIdCounter = 0;

patch(ListRenderer.prototype, {
    setup() {
        super.setup(...arguments);
        
        // Service ORM pour communiquer avec le backend
        this.isColumnWidthOrm = useService("orm");
        
        // Clé de vue pour identifier cette liste de manière unique
        this.isColumnWidthViewKey = this.createViewKey();
        
        // ID unique pour cette instance de table
        this.isTableId = `is-table-${++tableIdCounter}`;
        
        // Flag pour savoir si on est en train de redimensionner
        this.isResizing = false;
        
        console.log("[IsSetColumnWidth] ========== Setup pour viewKey:", this.isColumnWidthViewKey);
        
        // Debounce pour éviter trop d'appels au serveur lors du resize
        this.debouncedSaveColumnWidths = useDebounced(
            this._isSaveColumnWidthsToServer.bind(this), 
            500
        );
        
        // Intercepter le début et la fin du resize
        this._isOnPointerDown = this._isOnPointerDown.bind(this);
        this._isOnPointerUp = this._isOnPointerUp.bind(this);
        
        // IMPORTANT: onWillStart est appelé AVANT le premier rendu
        onWillStart(async () => {
            await this._isPreloadColumnWidths();
        });
        
        // useEffect s'exécute après chaque rendu
        useEffect(() => {
            // Si on n'est pas en train de redimensionner et qu'on a des largeurs sauvegardées
            if (!this.isResizing) {
                this._isApplyColumnWidthsFromCache();
            }
        });
        
        onMounted(() => {
            // Marquer la table avec notre ID
            if (this.tableRef?.el) {
                this.tableRef.el.dataset.isTableId = this.isTableId;
            }
            
            // Écouter les événements de pointeur sur les handles de resize
            window.addEventListener("pointerdown", this._isOnPointerDown, true);
            window.addEventListener("pointerup", this._isOnPointerUp, true);
            
            // Appliquer les largeurs si en cache
            if (columnWidthsCache[this.isColumnWidthViewKey]) {
                this._isApplyColumnWidthsFromCache();
            }
        });
        
        // Nettoyer lors de la destruction
        onWillUnmount(() => {
            window.removeEventListener("pointerdown", this._isOnPointerDown, true);
            window.removeEventListener("pointerup", this._isOnPointerUp, true);
            this._isRemoveInjectedStyle();
        });
    },

    /**
     * Intercepte le début du redimensionnement
     */
    _isOnPointerDown(ev) {
        // Vérifier si on clique sur un handle de resize
        if (ev.target.closest('.o_resize')) {
            const table = ev.target.closest('table');
            if (table && table.dataset.isTableId === this.isTableId) {
                console.log("[IsSetColumnWidth] Début du redimensionnement");
                this.isResizing = true;
                
                // IMPORTANT: Avant de supprimer le CSS !important, 
                // on applique les largeurs actuelles en style inline
                // pour éviter que les colonnes "sautent"
                const headers = [...table.querySelectorAll("thead th[data-name]")];
                for (const th of headers) {
                    const currentWidth = th.getBoundingClientRect().width;
                    if (currentWidth > 0) {
                        th.style.width = `${currentWidth}px`;
                    }
                }
                table.style.tableLayout = "fixed";
                
                // Maintenant on peut supprimer le CSS !important en toute sécurité
                this._isRemoveInjectedStyle();
            }
        }
    },

    /**
     * Intercepte la fin du redimensionnement
     */
    _isOnPointerUp(ev) {
        if (this.isResizing) {
            console.log("[IsSetColumnWidth] Fin du redimensionnement");
            this.isResizing = false;
            // Attendre un peu que Odoo finisse son traitement
            setTimeout(() => {
                this.debouncedSaveColumnWidths();
            }, 50);
        }
    },

    /**
     * Précharge les largeurs depuis le serveur AVANT le premier rendu
     */
    async _isPreloadColumnWidths() {
        const viewKey = this.isColumnWidthViewKey;
        if (!viewKey) return;
        
        if (columnWidthsCache[viewKey]) {
            console.log("[IsSetColumnWidth] ✓ Largeurs en cache:", columnWidthsCache[viewKey]);
            return;
        }
        
        if (loadingViews.has(viewKey)) {
            let attempts = 0;
            while (loadingViews.has(viewKey) && attempts < 50) {
                await new Promise(resolve => setTimeout(resolve, 20));
                attempts++;
            }
            return;
        }
        
        loadingViews.add(viewKey);
        
        try {
            const widths = await this.isColumnWidthOrm.call(
                "is.set.column.width",
                "get_column_widths",
                [viewKey]
            );
            if (widths && Object.keys(widths).length > 0) {
                columnWidthsCache[viewKey] = widths;
                console.log("[IsSetColumnWidth] ✓ Largeurs chargées:", widths);
            }
        } catch (error) {
            console.warn("[IsSetColumnWidth] Erreur:", error);
        } finally {
            loadingViews.delete(viewKey);
        }
    },

    /**
     * Injecte un style CSS avec !important pour forcer les largeurs
     */
    _isInjectStyle(columnStyles) {
        this._isRemoveInjectedStyle();
        
        const styleId = `is-column-width-style-${this.isTableId}`;
        const tableSelector = `table[data-is-table-id="${this.isTableId}"]`;
        
        // Ne pas bloquer les colonnes pendant le resize (classe o_resizing)
        let cssRules = `${tableSelector}:not(.o_resizing) { table-layout: fixed !important; }\n`;
        
        for (const [columnName, width] of Object.entries(columnStyles)) {
            // Appliquer seulement si la table n'est pas en cours de resize
            cssRules += `${tableSelector}:not(.o_resizing) thead th[data-name="${columnName}"] { 
                width: ${width}px !important; 
                min-width: ${width}px !important; 
                max-width: ${width}px !important; 
            }\n`;
        }
        
        const styleEl = document.createElement('style');
        styleEl.id = styleId;
        styleEl.textContent = cssRules;
        document.head.appendChild(styleEl);
    },
    
    /**
     * Supprime le style CSS injecté
     */
    _isRemoveInjectedStyle() {
        const styleId = `is-column-width-style-${this.isTableId}`;
        const existingStyle = document.getElementById(styleId);
        if (existingStyle) {
            existingStyle.remove();
        }
    },

    /**
     * Applique les largeurs depuis le cache
     */
    _isApplyColumnWidthsFromCache() {
        const viewKey = this.isColumnWidthViewKey;
        const savedWidths = columnWidthsCache[viewKey];
        
        if (!savedWidths || Object.keys(savedWidths).length === 0) return;
        if (!this.tableRef?.el) return;
        
        const table = this.tableRef.el;
        if (table.classList.contains("o_resizing")) return;
        
        // Marquer la table
        if (!table.dataset.isTableId) {
            table.dataset.isTableId = this.isTableId;
        }
        
        const headers = [...table.querySelectorAll("thead th[data-name]")];
        if (headers.length === 0) return;
        
        // Collecter les largeurs à appliquer
        const widthsToApply = {};
        for (const th of headers) {
            const columnName = th.dataset.name;
            if (columnName && savedWidths[columnName]) {
                widthsToApply[columnName] = savedWidths[columnName];
            }
        }
        
        if (Object.keys(widthsToApply).length > 0) {
            this._isInjectStyle(widthsToApply);
        }
    },

    /**
     * Récupère les largeurs actuelles des colonnes depuis le DOM
     */
    _isGetCurrentColumnWidths() {
        if (!this.tableRef?.el) return {};
        
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
    async _isSaveColumnWidthsToServer() {
        const viewKey = this.isColumnWidthViewKey;
        if (!viewKey) return;
        
        const columnWidths = this._isGetCurrentColumnWidths();
        if (Object.keys(columnWidths).length === 0) return;
        
        // Mettre à jour le cache
        columnWidthsCache[viewKey] = { ...columnWidthsCache[viewKey], ...columnWidths };
        
        console.log("[IsSetColumnWidth] Sauvegarde:", columnWidths);
        
        // Réinjecter le CSS avec les nouvelles largeurs
        this._isInjectStyle(columnWidths);
        
        try {
            await this.isColumnWidthOrm.call(
                "is.set.column.width",
                "set_column_widths",
                [viewKey, columnWidths]
            );
            console.log("[IsSetColumnWidth] ✓ Sauvegarde réussie");
        } catch (error) {
            console.warn("[IsSetColumnWidth] Erreur:", error);
        }
    },
});
