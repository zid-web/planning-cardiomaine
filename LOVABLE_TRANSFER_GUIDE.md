# Guide Complet pour Transfer à Lovable

## 📋 Vue d'ensemble du projet

**Application:** Plateforme de Gestion - Planning Cardiomaine  
**Framework:** Next.js 16 + React 19.2 + Supabase  
**Type:** Gestionnaire de planning médical avec authentification, rôles admin/user, et algorithme de scheduling

---

## 🏗️ Architecture du Projet

### Stack Technique
```
Frontend:
- Next.js 16 (App Router)
- React 19.2
- Tailwind CSS v4
- shadcn/ui (40+ composants)
- TypeScript

Backend:
- Next.js Server Actions
- Supabase (PostgreSQL)
- Real-time subscriptions

Libraries:
- react-hook-form + Zod (validation)
- Sonner (notifications)
- Lucide React (icônes)
- date-fns (dates)
- Recharts (graphiques)
```

### Structure des Dossiers
```
/app
  /actions           → Server actions (schedule-actions.ts)
  /layout.tsx        → Layout principal
  /page.tsx          → Page principale (logique complète)
  /globals.css       → Styles globaux

/components
  /ui                → 40+ composants shadcn/ui
  /schedule-app.tsx  → Composant principal du planning
  /admin-panel.tsx   → Panneau admin
  /landing-page.tsx  → Page d'accueil
  /live-clock.tsx    → Horloge en direct
  /learn-more-modal.tsx

/lib
  /db.ts             → Store en mémoire
  /supabase-client.ts → Client Supabase (côté client)
  /supabase-server.ts → Client Supabase (côté serveur)
  /types.ts          → Types TypeScript
  /constants.ts      → Constantes (médecins, couleurs, etc.)
  /schedule-utils.ts → Utilitaires pour le planning
  /guard-scheduler.ts → Algorithme de génération de gardes
  /scheduler-algo.ts → Statistiques de charge de travail

/public
  - Icons (favicons, app icons)
  - manifest.json (PWA)
```

---

## 🔑 Fonctionnalités Principales

### 1. Authentification & Sécurité
- **Login/Register** avec validation de mot de passe strict
- **Gestion des rôles:** Admin (M, Z) vs Utilisateur
- **Protection des comptes:** 5 tentatives échouées = blocage
- **Changement de mot de passe obligatoire** à la première connexion
- **Récupération de mot de passe** par email

### 2. Gestion du Planning
- **Vue Hebdomadaire:** Affichage par semaine avec tous les services
- **Vue Aujourd'hui:** Planning du jour actuel
- **Vue Complète:** Vue administrative de tous les plannings
- **Édition en direct** des cellules du planning
- **Notes du jour** pour chaque jour de la semaine
- **Synchronisation Real-time** via Supabase

### 3. Services Médicaux
- Gardes Nuit, Astreintes ATL
- Interventions Matin, Après-midi, Entrées
- Réeducation, LFB, PSSL, Scinti, IRM, CDL, NCT
- Hors site, Vacances, Rythmo

### 4. Algorithme de Planning
- **Génération automatique de gardes** basée sur contraintes 2026
- **Calcul de charge de travail** par médecin
- **Respect des blocages** (ex: Réeducation sur certains jours)
- **Gestion des jours fériés français**

### 5. Admin Panel
- Reset des utilisateurs avec clé de sécurité
- Mode maintenance
- Génération de propositions de gardes
- Statistiques de charge de travail

---

## 🗄️ Schéma Base de Données (Supabase)

### Table: `schedules`
```sql
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_key TEXT NOT NULL UNIQUE,
  schedule_data JSONB NOT NULL,
  updated_by TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Table: `users` (optionnelle pour production)
Pour implémenter une vraie authentification:
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL (hash en production),
  doctor_code TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  is_locked BOOLEAN DEFAULT FALSE,
  failed_attempts INTEGER DEFAULT 0,
  is_first_login BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 👥 Utilisateurs Par Défaut

```javascript
INITIAL_USERS = [
  { id: "M", firstName: "Marie", lastName: "Martin", doctorCode: "M", 
    password: "Admin123!", email: "marie@cardiomaine.fr", role: "admin" },
  { id: "Z", firstName: "Zoe", lastName: "Dupont", doctorCode: "Z",
    password: "Admin123!", email: "zoe@cardiomaine.fr", role: "admin" },
  // 12+ autres utilisateurs médecins...
]
```

---

## 🔌 Variables d'Environnement Requises

Créer un fichier `.env.local` ou utiliser les Vars du project Vercel:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxxxxxxxxxxx
SUPABASE_SERVICE_ROLE_KEY=xxxxxxxxxxxxxx
```

**Obtenir ces clés:**
1. Créer un projet Supabase sur supabase.com
2. Aller à Settings → API → Project URL et Keys
3. Copier les valeurs

---

## 📦 Dépendances NPM

### Production (26 packages)
```json
{
  "@hookform/resolvers": "^3.10.0",
  "@radix-ui/*": "[40+ composants UI]",
  "@supabase/ssr": "latest",
  "@supabase/supabase-js": "latest",
  "@vercel/analytics": "latest",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "cmdk": "1.0.4",
  "date-fns": "4.1.0",
  "embla-carousel-react": "8.5.1",
  "input-otp": "1.4.1",
  "lucide-react": "^0.454.0",
  "next": "16.0.10",
  "next-pwa": "latest",
  "next-themes": "^0.4.6",
  "react": "19.2.0",
  "react-dom": "19.2.0",
  "react-hook-form": "^7.60.0",
  "react-resizable-panels": "^2.1.7",
  "recharts": "2.15.4",
  "sonner": "latest",
  "tailwind-merge": "^2.5.5",
  "tailwindcss-animate": "^1.0.7",
  "vaul": "^0.9.9",
  "zod": "3.25.76"
}
```

### Dev (6 packages)
```json
{
  "@tailwindcss/postcss": "^4.1.9",
  "@types/node": "^22",
  "@types/react": "^19",
  "@types/react-dom": "^19",
  "postcss": "^8.5",
  "tailwindcss": "^4.1.9",
  "typescript": "^5"
}
```

---

## 🚀 Installation & Setup

### 1. Cloner/Importer le Repo
```bash
# Via GitHub (recommandé)
git clone https://github.com/zid-web/planning-cardiomaine.git

# Ou télécharger le ZIP depuis v0
```

### 2. Installer les dépendances
```bash
npm install
# ou
pnpm install
# ou
yarn install
```

### 3. Configurer Supabase
- Copier `.env.example` → `.env.local`
- Ajouter les clés Supabase (voir section Variables d'Environnement)

### 4. Initialiser la BD
- Copier le SQL du schéma dans Supabase Editor SQL
- Créer la table `schedules`

### 5. Lancer en développement
```bash
npm run dev
# L'app sera sur http://localhost:3000
```

### 6. Build & Deploy
```bash
# Build pour production
npm run build

# Tester la build
npm run start

# Déployer sur Vercel
vercel deploy
```

---

## 🔐 Points Clés de Sécurité

1. **Service Role Key:** Ne jamais exposer en client - garder côté serveur seulement
2. **Validation:** Tous les formulaires utilisent Zod + react-hook-form
3. **Passwords:** Minimum 10 chars, 1 majuscule, 1 chiffre, 1 caractère spécial
4. **Real-time:** Supabase Realtime pour sync en direct
5. **Audit:** Colonne `updated_by` pour tracer les modifications

---

## 📱 Responsive Design

- **Mobile First:** Design adaptatif avec Tailwind CSS
- **Breakpoints:** sm (640px), md (768px), lg (1024px), xl (1280px)
- **PWA:** Manifest inclus pour mobile apps

---

## 🎨 Thème & Styling

### Couleurs Principales
- Blue: `#0284C7` (primaire)
- Orange: Accents
- Slate: Neutres

### Composants UI
Tous les composants shadcn/ui sont pré-installés dans `/components/ui/`

### Tailwind v4
- Config: `@theme` dans `globals.css`
- Utilities: Tous les Tailwind v4 standards

---

## 🔄 Real-time & Subscriptions

Le projet utilise les **Supabase Realtime Channels** pour:
- Synchronisation des plannings entre utilisateurs
- Tracking de présence admin
- Updates instantanées des modifications

```typescript
// Exemple: Subscribe aux changements du planning
channel.on('postgres_changes', 
  { event: '*', schema: 'public', table: 'schedules' },
  (payload) => { /* handle update */ }
).subscribe()
```

---

## 🧪 Testing

Aucun test automatisé actuellement. Pour ajouter:
- Jest + React Testing Library
- E2E avec Cypress/Playwright

---

## 📝 Fichiers Clés à Connaître

| Fichier | Rôle |
|---------|------|
| `app/page.tsx` | Logique principale (742 lignes) |
| `components/schedule-app.tsx` | Affichage du planning (1082 lignes) |
| `lib/guard-scheduler.ts` | Algorithme de gardes |
| `lib/constants.ts` | Médecins, couleurs, jours |
| `app/actions/schedule-actions.ts` | Server actions Supabase |
| `lib/supabase-*.ts` | Clients Supabase |

---

## 🎯 Prochaines Étapes pour Lovable

1. **Connexion GitHub:** Push les changements via Git
2. **Env Vars:** Ajouter les clés Supabase dans les Settings
3. **DB:** Préparer la table Supabase
4. **Deploy:** Publier sur Vercel
5. **Tests:** Tester l'intégration end-to-end

---

## 💡 Tips de Maintenabilité

1. **Types:** Les types sont centralisés dans `lib/types.ts`
2. **Constants:** Ajouter les constantes dans `lib/constants.ts`
3. **Utils:** Créer des functions utilitaires dans `lib/`
4. **Components:** Garder les composants petits et réutilisables
5. **Server Actions:** Grouper les DB operations dans `app/actions/`

---

## 🆘 Troubleshooting

### Erreur: "SUPABASE_URL not set"
→ Ajouter `.env.local` avec les clés Supabase

### Real-time ne fonctionne pas
→ Vérifier les permissions RLS dans Supabase

### Styles Tailwind ne s'appliquent pas
→ Vérifier `import './globals.css'` dans le layout

---

## 📞 Contact & Support

Pour des questions sur le code:
- Consulter les commentaires `[v0]` dans les fichiers
- Vérifier les types dans `lib/types.ts`
- Tester avec `console.log("[v0] ...")`

---

**Généré avec v0 | Next.js 16 | Supabase | Tailwind CSS v4**
