# Configuration Rapide pour Lovable

## ⚡ 5 Étapes pour Import Complet

### 1️⃣ **Préparer le Repository GitHub**

```bash
# Le repo est déjà à cette adresse:
https://github.com/zid-web/planning-cardiomaine

# Vérifier que tous les fichiers sont commités
git status
git add .
git commit -m "Prêt pour transfer à Lovable"
git push origin v0/lovable-app-transfer-e2f6ccd2
```

### 2️⃣ **Importer dans Lovable**

1. Aller sur **lovable.dev**
2. Cliquer **"Import from GitHub"**
3. Sélectionner: `zid-web/planning-cardiomaine`
4. Branche: `v0/lovable-app-transfer-e2f6ccd2`
5. Cliquer **"Create Project"**

### 3️⃣ **Configurer les Variables d'Environnement**

Dans Lovable Settings → **Vars**:

```
NEXT_PUBLIC_SUPABASE_URL = https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = xxxxxxxxxxxxxx
SUPABASE_SERVICE_ROLE_KEY = xxxxxxxxxxxxxx
```

**Trouver ces valeurs:**
1. Aller sur supabase.com
2. Dashboard → Project Settings → API
3. Copier: Project URL et les keys

### 4️⃣ **Initialiser la Base de Données**

**Option A: Supabase Web Editor (Recommandé)**
1. Aller sur supabase.com → SQL Editor
2. Copier-coller ce SQL:

```sql
-- Créer la table schedules
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_key TEXT NOT NULL UNIQUE,
  schedule_data JSONB NOT NULL,
  updated_by TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Créer des indexes pour performance
CREATE INDEX idx_schedules_week_key ON schedules(week_key);
CREATE INDEX idx_schedules_updated_at ON schedules(updated_at);

-- Activer Real-time
ALTER PUBLICATION supabase_realtime ADD TABLE schedules;
```

3. Cliquer **"Run"**

**Option B: Via Lovable Terminal**
```bash
npm run setup-db
```

### 5️⃣ **Tester & Déployer**

```bash
# Build de test
npm run build

# Vérifier les erreurs
npm run lint

# Déployer sur Vercel (depuis Lovable)
# Cliquer "Publish" en haut à droite
```

---

## 🔐 Credentials de Test

### Comptes Admin
```
ID: M
Password: Admin123!
Email: marie@cardiomaine.fr

---

ID: Z
Password: Admin123!
Email: zoe@cardiomaine.fr
```

### Comptes Médecins (exemples)
```
ID: DR1
Password: Doctor1!
Email: dr1@cardiomaine.fr

ID: DR2
Password: Doctor2!
Email: dr2@cardiomaine.fr
```

---

## 📊 Checklist Pre-Deploy

- [ ] Git repo synchronisé
- [ ] Variables d'env ajoutées dans Lovable
- [ ] Table Supabase créée
- [ ] `npm run build` réussit sans erreurs
- [ ] Login fonctionne avec compte test
- [ ] Planning s'affiche correctement
- [ ] Real-time sync fonctionne (changements en direct)
- [ ] Mode Admin accessible

---

## 🚀 Déployer sur Vercel (depuis Lovable)

1. Cliquer **"Publish"** (haut droit)
2. Lovable va créer une PR GitHub
3. Approuver & merge la PR
4. Vercel déploiera automatiquement

---

## ⚙️ Configuration Post-Deploy

### Domain Custom
1. Lovable Settings → Domains
2. Ajouter votre domaine
3. Suivre les instructions DNS

### Analytics
```typescript
// Déjà configuré dans app/layout.tsx
import { Analytics } from "@vercel/analytics/next"
```

### PWA (Progressive Web App)
```
// Fichier manifest.json dans /public
// Déjà configuré pour mobile apps
```

---

## 🔍 Vérifier que tout Fonctionne

### Checklist Post-Deploy

```bash
# 1. Vérifier la build
curl https://votre-domaine.com

# 2. Vérifier les logs
# Dans Lovable: Logs → Build & Runtime

# 3. Tester le login
# Visiter le site, essayer ID: M / Password: Admin123!

# 4. Vérifier la BD
# Dans Supabase: Tables → schedules → devrait avoir des données
```

---

## 🔗 Ressources Importantes

- **Lovable Docs:** https://docs.lovable.dev
- **Supabase Docs:** https://supabase.com/docs
- **Next.js 16 Docs:** https://nextjs.org/docs
- **GitHub Repo:** https://github.com/zid-web/planning-cardiomaine

---

## ❓ Questions Fréquentes

**Q: Comment changer le mot de passe des utilisateurs?**
A: Dans app/page.tsx, l'utilisateur doit valider sa première connexion

**Q: Comment ajouter un nouvel utilisateur?**
A: Dans INITIAL_USERS (lib/constants.ts) ou via la BD Supabase

**Q: Comment sauvegarder les plannings?**
A: Automatique avec Supabase - tous les changements sont sauvegardés

**Q: Le real-time ne fonctionne pas?**
A: Vérifier que les clés Supabase sont correctes et que RLS n'est pas activé

**Q: Comment restaurer une ancienne version?**
A: Lovable permet de revenir à n'importe quelle version antérieure

---

## 📞 Support

- **Bug Report:** Créer une issue sur GitHub
- **Questions:** Consulter LOVABLE_TRANSFER_GUIDE.md
- **Supabase Issues:** support.supabase.com

---

**Prêt? Bon transfer! 🎉**
