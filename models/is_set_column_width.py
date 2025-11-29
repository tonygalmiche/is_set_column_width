from odoo import models, fields, api
import json


class IsSetColumnWidth(models.Model):
    _name = 'is.set.column.width'
    _description = 'Mémorisation des largeurs de colonnes'
    _rec_name = 'view_key'

    user_id = fields.Many2one('res.users', string='Utilisateur', required=True, ondelete='cascade', index=True)
    view_key = fields.Char(string='Clé de vue', required=True, index=True, 
                           help="Identifiant unique de la vue (model,viewMode,viewId,...)")
    column_widths = fields.Text(string='Largeurs des colonnes', 
                                help="JSON contenant les largeurs des colonnes {nom_colonne: largeur}")

    _sql_constraints = [
        ('user_view_unique', 'unique(user_id, view_key)', 
         'Une seule configuration par utilisateur et par vue')
    ]

    @api.model
    def get_column_widths(self, view_key):
        """Récupère les largeurs de colonnes pour l'utilisateur courant et la vue donnée"""
        record = self.search([
            ('user_id', '=', self.env.uid),
            ('view_key', '=', view_key)
        ], limit=1)
        if record and record.column_widths:
            try:
                return json.loads(record.column_widths)
            except json.JSONDecodeError:
                return {}
        return {}

    @api.model
    def set_column_widths(self, view_key, column_widths):
        """Sauvegarde les largeurs de colonnes pour l'utilisateur courant et la vue donnée"""
        record = self.search([
            ('user_id', '=', self.env.uid),
            ('view_key', '=', view_key)
        ], limit=1)
        
        widths_json = json.dumps(column_widths)
        
        if record:
            record.write({'column_widths': widths_json})
        else:
            self.create({
                'user_id': self.env.uid,
                'view_key': view_key,
                'column_widths': widths_json
            })
        return True



