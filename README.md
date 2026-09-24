# is_set_column_width - Mémorisation des largeurs de colonnes

## Description

Module Odoo 20 permettant de **mémoriser automatiquement les largeurs de colonnes** des vues liste (tree) pour chaque utilisateur. Lorsqu'un utilisateur redimensionne une colonne dans un tableau, la nouvelle largeur est sauvegardée en base de données et restaurée automatiquement lors des prochaines visites.

## Fonctionnalités

- ✅ **Sauvegarde automatique** : Les largeurs de colonnes sont sauvegardées automatiquement après redimensionnement
- ✅ **Restauration automatique** : Les largeurs sont restaurées au chargement de chaque vue liste
- ✅ **Par utilisateur** : Chaque utilisateur a ses propres préférences de largeur de colonnes
- ✅ **Par vue** : Les largeurs sont mémorisées séparément pour chaque vue liste
- ✅ **Interface d'administration** : Menu pour visualiser et gérer les préférences enregistrées

## Architecture technique

### Modèle Python (`is.set.column.width`)

Le modèle stocke les préférences avec les champs suivants :
- `user_id` : Référence vers l'utilisateur (Many2one vers `res.users`)
- `view_key` : Identifiant unique de la vue (chaîne de caractères)
- `column_widths` : Données JSON contenant les largeurs des colonnes

**Méthodes principales :**
- `get_column_widths(view_key)` : Récupère les largeurs sauvegardées pour l'utilisateur courant
- `set_column_widths(view_key, column_widths)` : Sauvegarde les largeurs pour l'utilisateur courant

### JavaScript (Patch du ListRenderer)

Le module patche le composant `ListRenderer` d'Odoo pour :

1. **Au montage de la vue** (`onMounted`) :
   - Génère une clé unique pour la vue
   - Charge les largeurs sauvegardées depuis le serveur
   - Applique les largeurs aux colonnes du tableau

2. **Après chaque rendu** (`onPatched`) :
   - Réapplique les largeurs sauvegardées pour maintenir la cohérence

3. **Lors du redimensionnement** :
   - Intercepte l'événement `pointerup` sur la fenêtre
   - Détecte si un redimensionnement de colonne était en cours (classe `o_resizing`)
   - Sauvegarde les nouvelles largeurs avec un debounce de 800ms

## Installation

1. Copier le module dans le répertoire des addons Odoo
2. Mettre à jour la liste des modules
3. Installer le module "InfoSaône - Fixer et mémoriser la largeur des colonnes dans Odoo 20"

## Dépendances

- `base`
- `web`

## Utilisation

### Pour les utilisateurs

Le module fonctionne de manière transparente :
1. Ouvrez n'importe quelle vue liste dans Odoo
2. Redimensionnez une colonne en faisant glisser son bord
3. La nouvelle largeur est automatiquement sauvegardée
4. Lors de votre prochaine visite, la colonne conservera la largeur définie

### Pour les administrateurs

Un menu est disponible dans **Paramètres > Utilisateurs et sociétés > Préférences de colonnes** pour :
- Visualiser toutes les préférences enregistrées
- Filtrer par utilisateur
- Supprimer des préférences si nécessaire

## Droits d'accès

Tous les utilisateurs internes (`base.group_user`) ont les droits complets (lecture, écriture, création, suppression) sur leurs propres préférences de colonnes.

## Licence

AGPL-3

## Auteur

**InfoSaône / Tony Galmiche**  
🌐 [www.infosaone.com](http://www.infosaone.com)
