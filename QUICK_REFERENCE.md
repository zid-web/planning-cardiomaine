# ⚡ Quick Reference Guide

*Cheat sheet pour développeurs Lovable*

---

## 🚀 Commandes Essentielles

```bash
# Installation
npm install

# Développement
npm run dev          # http://localhost:3000

# Build Production
npm run build
npm run start

# Linting
npm run lint

# Nettoyage
rm -rf .next node_modules
npm install
```

---

## 🔐 Credentials de Test

### Admin
```
Login ID: M
Password: Admin123!
```

### Utilisateur
```
Login ID: DR1
Password: Doctor1!
```

---

## 📁 Chemins Importants

```
/app/page.tsx              → Logique principale (742 lignes)
/components/schedule-app   → Affichage du planning (1082 lignes)
/lib/constants.ts          → Médecins, couleurs, jours
/lib/types.ts              → Types TypeScript
/app/actions/              → Server actions (Supabase)
/components/ui/            → 40+ composants shadcn
```

---

## 🌍 URLs Importantes

```
App: http://localhost:3000
Supabase Dashboard: https://app.supabase.com
Next.js Docs: https://nextjs.org/docs
Tailwind Docs: https://tailwindcss.com/docs
shadcn/ui: https://ui.shadcn.com
```

---

## 📝 Fichiers de Documentation

```
LOVABLE_TRANSFER_GUIDE.md  → 📘 Guide complet (380 lignes)
LOVABLE_SETUP.md           → 🚀 Setup rapide (216 lignes)
PROJECT_FILES_INVENTORY.md → 📦 Liste complète des fichiers
QUICK_REFERENCE.md         → ⚡ Ce fichier
```

---

## 🎨 Ajouter un Nouveau Composant shadcn

```bash
# Installation d'un composant
npx shadcn-ui@latest add button

# Puis l'importer
import { Button } from "@/components/ui/button"
```

---

## 🔧 Variables d'Environnement (.env.local)

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxxxxxxxxxxx
SUPABASE_SERVICE_ROLE_KEY=xxxxxxxxxxxxxx
```

---

## 📊 Structure BD Supabase

### Table: schedules
```sql
week_key            TEXT (semaine: 2025-W01)
schedule_data       JSONB (planning complet)
updated_by          TEXT (qui l'a modifié)
updated_at          TIMESTAMP (quand)
```

---

## 🔄 Real-time Supabase

```typescript
// Écouter les changements
const channel = supabase
  .channel('schedules')
  .on('postgres_changes', 
    { event: '*', table: 'schedules' },
    (payload) => console.log(payload)
  )
  .subscribe()
```

---

## 💡 Tips Rapides

### Ajouter un Médecin
1. Ouvrir `lib/constants.ts`
2. Ajouter dans `DOCTORS` array
3. Ajouter dans `DOCTOR_COLORS` map

### Changer les Couleurs
- `lib/constants.ts` → `DOCTOR_COLORS`

### Ajouter un Service
- `lib/constants.ts` → Modifier la structure

### Modifier le Planning
- `components/schedule-app.tsx` → Vue management
- `lib/guard-scheduler.ts` → Algorithme

---

## 🐛 Debugging

```typescript
// Logs de debug
console.log("[v0] Debug message", variable)

// Vérifier le state
console.log("Current state:", { currentUser, view })

// Erreurs Supabase
console.error("[v0] Supabase error:", error)
```

---

## 📱 Responsive Breakpoints (Tailwind)

```
sm:  640px   (téléphones)
md:  768px   (tablettes)
lg:  1024px  (desktop)
xl:  1280px  (large)
```

Usage: `hidden md:block` (masquer sur mobile, afficher sur tablette+)

---

## ✅ Checklist Pre-Deploy

- [ ] `npm run build` réussit
- [ ] Pas de TypeScript errors
- [ ] Variables d'env configurées
- [ ] BD Supabase initialisée
- [ ] Login fonctionne
- [ ] Planning s'affiche
- [ ] Real-time sync OK

---

## 🎯 Modèles de Code Courants

### Import composant shadcn
```tsx
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
```

### Server Action Supabase
```typescript
export async function saveData(data: any) {
  const supabase = await getSupabaseServer()
  const { data: result, error } = await supabase
    .from("table")
    .insert(data)
  if (error) throw new Error(error.message)
  return result
}
```

### Client Component avec State
```tsx
"use client"
import { useState } from "react"

export function MyComponent() {
  const [state, setState] = useState(false)
  return <div>...</div>
}
```

### Toast Notification
```typescript
import { toast } from "sonner"
toast.success("Succès!")
toast.error("Erreur!")
```

---

## 🔍 Rechercher/Remplacer

### Tous les médecins
Fichier: `lib/constants.ts`
Array: `DOCTORS`

### Tous les services
Fichier: `lib/constants.ts`
Variable: Structure de planning

### Toutes les couleurs
Fichier: `lib/constants.ts`
Map: `DOCTOR_COLORS`

---

## 🚨 Erreurs Courants

### "Module not found"
→ Vérifier l'import (utiliser `@/` pour chemins)

### "Supabase connection failed"
→ Vérifier les keys d'env

### "Styles ne s'appliquent pas"
→ Vérifier `import './globals.css'` dans layout

### "Real-time ne fonctionne pas"
→ Vérifier permissions RLS en Supabase

### "Build fails"
→ Lancer `npm run lint` pour voir les erreurs TypeScript

---

## 📦 Versions Clés

```
Next.js:  16.0.10
React:    19.2.0
TypeScript: 5.x
Tailwind: 4.1.9
Supabase: latest
```

---

## 🎓 Ressources d'Apprentissage

- [Next.js 16 Docs](https://nextjs.org/docs)
- [React 19 Docs](https://react.dev)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com)

---

## 🔐 Sécurité

```typescript
// ✅ Côté serveur (SECURE)
"use server"
export async function deleteUser(id: string) {
  // Opération DB sécurisée
}

// ❌ Jamais côté client
const apiKey = process.env.SUPABASE_SERVICE_ROLE_KEY // ❌ ERREUR!

// ✅ Serveur Actions à la place
"use server"
import { getSupabaseServer } from "@/lib/supabase-server"
```

---

## 💬 Convention de Code

- **Imports:** Chemins absolus avec `@/`
- **Exports:** Named exports par défaut
- **Naming:** camelCase pour variables, PascalCase pour composants
- **Types:** Typage TypeScript strict
- **Comments:** Utiliser `// [v0]` pour les notes de debug

---

## 🎉 Vous êtes Prêt!

Avec ce guide et la documentation, vous avez tout pour:
- ✅ Comprendre l'architecture
- ✅ Modifier le code
- ✅ Ajouter des fonctionnalités
- ✅ Déployer en production

**Questions?** Consultez les 3 guides complets:
1. LOVABLE_TRANSFER_GUIDE.md
2. LOVABLE_SETUP.md
3. PROJECT_FILES_INVENTORY.md

---

**Bon développement! 🚀**
