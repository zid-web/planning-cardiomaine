# Guide d'activation du PDF Upload

## 🔧 État actuel

La fonctionnalité d'upload PDF est **entièrement configurée** dans le code:
- ✅ Composant `VoiceAndUploadPanel` existe et est importé dans `/protected/planning`
- ✅ Zone de drag & drop est rendue (bordure pointillée, texte "Cliquez ou glissez-déposez")
- ✅ Appel API vers `${apiBaseUrl}/upload-planning-pdf` est configuré
- ✅ Logs de debug ajoutés pour tracer le flux

## 📋 Checklist de vérification

### 1. Vérifier que vous êtes connecté en tant qu'admin

Ouvrez la console (F12) → Tab **Console** et cherchez:
```
🔍 [Planning] isAdmin: true
```

**Si vous voyez `false`:**
- Votre compte n'est pas marqué comme admin dans la DB Supabase
- Connectez-vous avec un compte admin (M ou Z) ou modifiez votre profil dans Supabase

### 2. Vérifier que le composant charge

Dans la console, cherchez:
```
🔍 [VoiceAndUploadPanel] Composant chargé
🔍 [VoiceAndUploadPanel] API Base URL: https://guard-api-cardiomaine.onrender.com
```

### 3. Tester l'upload

1. Si vous êtes admin → Le panneau "Commandes intelligentes" doit s'afficher **sous le bouton de navigation**
2. Dans le panneau → Vous verrez:
   - 🎤 Bouton "Écouter" (reconnaissance vocale)
   - 📄 Zone de drag & drop pour PDF
3. Cliquez sur "Cliquez pour sélectionner" ou glissez un PDF dans la zone

### 4. Vérifier les logs d'upload

Quand vous uploadez un PDF:
```
🔍 [Upload] Début upload PDF: myfile.pdf
🔍 [Upload] URL: https://guard-api-cardiomaine.onrender.com/upload-planning-pdf
🔍 [Upload] API Key présent: true
🔍 [Upload] Envoi requête POST...
🔍 [Upload] Réponse reçue: 200 OK
```

## 🚀 Pour activer sur un compte non-admin

Si vous n'êtes pas admin et que vous voulez tester l'upload:

### Option 1: Modifier le code (rapide)
Éditez `/app/protected/planning/page.tsx` ligne 259:
```tsx
// Avant:
{isAdmin && (

// Après:
{true && ( // Temporaire - forcer l'affichage
```

### Option 2: Modifier la DB Supabase (propre)
Dans Supabase → `profiles` table → Changez votre `role` en `admin`

## 📊 Architecture

- **Frontend**: `/app/protected/planning/page.tsx` + `components/VoiceAndUploadPanel.tsx`
- **Backend API**: https://guard-api-cardiomaine.onrender.com/upload-planning-pdf
- **Env vars**: `NEXT_PUBLIC_GUARD_API_BASE_URL`, `NEXT_PUBLIC_GUARD_API_KEY`
- **DB**: Supabase (schedules, profiles tables)

## 🐛 Troubleshooting

| Problème | Solution |
|----------|----------|
| Panneau not visible | Cherchez `🔍 [Planning] isAdmin:` dans console → doit être `true` |
| API error 422 | Vérifiez payload = `{"file": ..., "week_request": {...}}` |
| API error 500 | Vérifiez logs Render: https://dashboard.render.com |
| Upload lent | C'est normal - Render peut prendre 10-30s pour parser PDF |

## ✅ Résultat attendu après fix

1. Page se charge normalement
2. Panneau "Commandes intelligentes" visible pour admins
3. Upload PDF envoie à Render
4. Planning se met à jour avec les données du PDF

---

**Pour plus d'infos**: Vérifiez les logs console (F12) et Render logs pour le détail technique.
