# ✅ Configuration `.env.local` - Guide de Vérification

## 📋 Fichier créé

Un fichier `.env.local` a été créé à la racine du projet avec:

```env
# SUPABASE - Authentification et base de données
NEXT_PUBLIC_SUPABASE_URL=https://cdvzcrworcjwtxjdymen.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# API RENDER - Solveur OR-Tools
NEXT_PUBLIC_GUARD_API_BASE_URL=https://guard-api-cardiomaine.onrender.com
NEXT_PUBLIC_GUARD_API_KEY=sk_guard_xxxxxxxxxxx
```

---

## 🔍 Vérification des variables

### Étape 1: Ouvrir F12 Console
- Appuyez sur `F12` dans le navigateur
- Allez à l'onglet **Console**

### Étape 2: Chercher les logs au chargement
Quand vous ouvrez la page, vous devriez voir:

```
[v0] NEXT_PUBLIC_SUPABASE_URL env var: true
[v0] NEXT_PUBLIC_SUPABASE_ANON_KEY env var: true
[v0] Supabase client created successfully
```

### Étape 3: Tester la connexion
1. Allez à `http://localhost:3000/auth/login`
2. Vous devriez voir:
   - Champ Email (exemple: `m@example.com`)
   - Champ Password (exemple: `Use temporary password: 1234`)
   - Bouton "Login"

---

## 🔐 Sécurité: `.gitignore`

✅ **Confirmé:** `.env.local` est dans `.gitignore`

Cela signifie:
- Les secrets ne seront PAS versionnés sur GitHub
- Le fichier reste privé sur votre machine
- Personne ne peut accéder à vos clés

---

## ⚙️ Configuration complète des variables

### NEXT_PUBLIC_SUPABASE_ANON_KEY
**À remplir:** Votre vraie clé anon de Supabase

1. Allez à [https://app.supabase.com](https://app.supabase.com)
2. Ouvrez votre projet
3. **Settings** (⚙️) → **API**
4. Copiez **anon public** key
5. Remplacez la valeur dans `.env.local`

### NEXT_PUBLIC_GUARD_API_KEY
**À remplir:** Votre clé API Render (si elle existe)

1. Sur [https://render.com](https://render.com)
2. Allez à vos services
3. Récupérez la clé définie pour `guard-api-cardiomaine`
4. Remplacez la valeur dans `.env.local`

---

## ✅ Checklist finale

- [ ] Fichier `.env.local` créé à la racine
- [ ] Variables Supabase et Render complétées
- [ ] Serveur redémarré (`npm run dev`)
- [ ] F12 Console affiche les logs d'env vars
- [ ] Page login charge correctement
- [ ] `.gitignore` contient `.env.local`

---

## 🚀 Prêt?

Une fois toutes les variables configurées:
1. Vous pouvez vous connecter via la page login
2. Accéder au planning `/protected/planning`
3. Utiliser l'upload PDF et les commandes vocales (si admin)

**Bon courage!** 🎯
