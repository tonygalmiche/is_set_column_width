# -*- coding: utf-8 -*-
{
    "name": "InfoSaône - Fixer et mémoriser la largeur des colonnes dans Odoo 18",
    "version": "18.0.1.0.0",
    "author": "InfoSaône / Tony Galmiche",
    "category": "InfoSaône",
    "summary": "Mémorise les largeurs de colonnes par utilisateur",
    "description": "Ce module permet de mémoriser pour chaque utilisateur les largeurs de colonnes qu'il a définies dans les tableaux.",
    "maintainer": "InfoSaône",
    "website": "http://www.infosaone.com",
    "depends": [
        'base',
        'web',
    ],
    "data": [
        'security/ir.model.access.csv',
        'views/is_set_column_width_views.xml',
    ],
    "assets": {
        'web.assets_backend': [
            'is_set_column_width/static/src/js/is_set_column_width.js',
        ],
    },
    "installable": True,
    "auto_install": False,
    "application": False,
    "license": "AGPL-3",
}
