# CAQ Support Tool 🇨🇦

Outil d'aide à l'analyse et à la validation des dossiers de Certificat d'acceptation du Québec (CAQ). Cette application permet de vérifier la conformité des documents, de gérer les situations spécifiques (mineurs, renouvellements) et de reconstituer la chronologie des séjours.

## 🚀 Fonctionnalités

- **Analyse de Dossier** : Vérification automatique basée sur les catégories GPI (MAJ/MIN, NC/C).
- **Gestion des Mineurs** : Logique dédiée pour les situations A, B, C et D selon les directives officielles.
- **Vérification de la Capacité Financière** : Calcul des seuils et validation des preuves (relevés 6 mois).
- **Chronologie Interactive** : Reconstitution visuelle des événements avec auto-clacul des plages de dates.
- **Références Légales** : Affichage systématique des articles du RIQ (Art. 11, 13, 14, 15) pour justifier les recommandations.

## 🛠️ Installation

1. **Cloner le projet** :
   ```bash
   git clone https://github.com/Boemien/caq-support-tool.git
   cd caq-support-tool
   ```

2. **Installer les dépendances** :
   ```bash
   npm install
   ```

## 📖 Scripts Disponibles

Dans le répertoire du projet, vous pouvez exécuter :

| Commande | Action |
| :--- | :--- |
| `npm run dev` | Lance l'application en mode développement (Vite). |
| `npm run build` | Compile l'application pour la production dans le dossier `dist`. |
| `npm run deploy` | **Automatisé** : Compile le projet et déploie le contenu de `dist` sur GitHub Pages. |
| `npm run preview` | Prévisualise localement le build de production. |

## 🌐 Déploiement

L'application est configurée pour être déployée sur GitHub Pages. Pour mettre à jour la version en ligne :
```bash
npm run deploy
```

## 🛡️ Technologies

- **React 18** + **Vite**
- **Lucide React** (Iconographie)
- **Date-fns** (Gestion des dates)
- **Vanilla CSS** (Design moderne et responsive)

---
*Développé pour faciliter l'analyse légale et documentaire de l'immigration au Québec.*
