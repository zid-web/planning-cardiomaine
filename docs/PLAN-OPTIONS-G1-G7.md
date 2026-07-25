# Plan d’implémentation — Options G1 à G7

> Cardiomaine Planning · Next.js 16 (App Router) · Supabase · ScheduleApp · Solveur OR-Tools (Render)  
> Document de conception prêt à implémenter. Priorité : **G1 → G2 → G3**, puis G4 / G5 / G6.  
> **G7** n’est pas spécifié dans le brief utilisateur — voir § G7.

---

## 0. Récapitulatif

| ID | Fonctionnalité | Priorité | Effort relatif | Dépendances clés |
|----|----------------|----------|----------------|------------------|
| **G1** | Export PDF du planning (admin) | P0 | M | `pdf-lib` (serveur) |
| **G2** | Historique des modifications | P0 | M | table `schedule_history` + écriture dans `saveScheduleToDb` |
| **G3** | Sync admins (Realtime `schedules`) | P0 | M | publication Realtime + canal dans `ScheduleApp` |
| **G4** | Import CSV / Excel | P1 | M | `papaparse`, `xlsx` + parseur local |
| **G5** | Gestion des comptes admin | P1 | L | Admin API Supabase (service role) |
| **G6** | Corrections de bugs observés | P0 | S–M | aucun nouveau package |
| **G7** | *Non spécifié* | — | — | À clarifier |

### Hypothèses structurantes

1. **Source de vérité semaine** : ligne `schedules` avec `week_key = "YYYY-Www"` (ex. `2026-W30`). Le blob `week_key = "full_schedule"` reste un cache de confort ; G2/G3 doivent privilégier les lignes semaine.
2. **Toute écriture passe par** `app/actions/schedule-actions.ts` (`saveScheduleToDb` / éventuellement un wrapper `saveWeekSchedule`) pour centraliser historique + version.
3. **Ne pas réécrire** la logique planning dans `app/protected/planning/page.tsx` — uniquement dans `components/schedule-app.tsx` (et composants enfants).
4. **RLS** : aujourd’hui très permissive (`USING (true)`). Les nouvelles tables suivent le même modèle en local, avec durcissement admin-only recommandé en prod (via `is_admin()` déjà défini).
5. **Middleware** gate `/api/*` : les routes d’export/import nécessitent une session authentifiée.

### Ordre d’implémentation recommandé (PRs)

```
PR-G6 (bugs sync full_schedule)  →  PR-G2 (history)  →  PR-G3 (realtime)
                                              ↘
PR-G1 (PDF export)     PR-G4 (CSV/XLSX)     PR-G5 (users)
```

G1 peut démarrer en parallèle de G2. G3 est plus robuste **après** G2 (évite d’historiser deux fois lors d’un echo Realtime).

---

## G1 — Export du planning en PDF

### Description technique

- Bouton **« Exporter en PDF »** visible uniquement si `isAdmin` dans `ScheduleApp` (header, à côté de « Demandes »).
- Clic → `GET` ou `POST` vers une **API Route serveur** qui :
  1. vérifie la session + rôle admin ;
  2. charge `schedule_data` pour `week_key` (query) ;
  3. génère un PDF (grille activités × jours + notes) ;
  4. renvoie `application/pdf` en téléchargement.
- Préférence **serveur** (`pdf-lib`) : pas de rendu React côté client, contrôle typographique, pas de flash UI.

### Base de données

Aucune migration. Lecture seule de `schedules`.

### Dépendances

```bash
bun add pdf-lib
```

### Fichiers à créer / modifier

| Fichier | Rôle |
|---------|------|
| `app/api/export-planning-pdf/route.ts` | Génération + auth |
| `lib/planning-pdf.ts` | Construction du document `pdf-lib` |
| `components/schedule-app.tsx` | Bouton admin |

### Code — API route (extrait)

```ts
// app/api/export-planning-pdf/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { buildPlanningPdf } from "@/lib/planning-pdf"
import type { ScheduleData } from "@/lib/types"

export async function GET(req: NextRequest) {
  const weekKey = req.nextUrl.searchParams.get("week_key")
  if (!weekKey) {
    return NextResponse.json({ error: "week_key requis" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData?.user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single()

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin requis" }, { status: 403 })
  }

  const { data: row, error } = await supabase
    .from("schedules")
    .select("schedule_data")
    .eq("week_key", weekKey)
    .single()

  if (error || !row) {
    return NextResponse.json({ error: "Planning introuvable" }, { status: 404 })
  }

  const bytes = await buildPlanningPdf(weekKey, row.schedule_data as ScheduleData)
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="planning-${weekKey}.pdf"`,
    },
  })
}
```

### Code — générateur PDF (esquisse)

```ts
// lib/planning-pdf.ts
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import { DAYS } from "@/lib/constants"
import type { ScheduleData } from "@/lib/types"

export async function buildPlanningPdf(weekKey: string, schedule: ScheduleData) {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
  let page = doc.addPage([842, 595]) // A4 paysage
  const { width, height } = page.getSize()
  let y = height - 40

  page.drawText(`Planning Cardiomaine — ${weekKey}`, {
    x: 40, y, size: 16, font: fontBold, color: rgb(0.1, 0.2, 0.4),
  })
  y -= 28

  const rowKeys = Object.keys(schedule).filter((k) => k !== "Notes du jour")
  const colW = (width - 160) / DAYS.length

  // En-tête jours
  page.drawText("Activité", { x: 40, y, size: 9, font: fontBold })
  DAYS.forEach((d, i) => {
    page.drawText(d.slice(0, 3), { x: 160 + i * colW, y, size: 9, font: fontBold })
  })
  y -= 14

  for (const rowKey of rowKeys) {
    if (y < 40) {
      page = doc.addPage([842, 595])
      y = height - 40
    }
    const label = rowKey.replace("Matin - ", "").replace("Apm - ", "").slice(0, 22)
    page.drawText(label, { x: 40, y, size: 7, font })
    DAYS.forEach((day, i) => {
      const docs = schedule[rowKey]?.[day]?.value?.join(",") || ""
      page.drawText(docs.slice(0, 12), { x: 160 + i * colW, y, size: 7, font })
    })
    y -= 11
  }

  // Notes
  y -= 10
  page.drawText("Notes du jour", { x: 40, y, size: 10, font: fontBold })
  y -= 12
  for (const day of DAYS) {
    const note = schedule["Notes du jour"]?.[day]?.value?.[0] || ""
    if (!note) continue
    page.drawText(`${day}: ${note.slice(0, 80)}`, { x: 40, y, size: 8, font })
    y -= 10
  }

  return doc.save()
}
```

### Code — bouton UI

```tsx
// Dans ScheduleApp, bloc isAdmin du header :
<Button
  variant="outline"
  size="sm"
  onClick={() => {
    window.location.href = `/api/export-planning-pdf?week_key=${encodeURIComponent(weekKey)}`
  }}
>
  Exporter en PDF
</Button>
```

### Guide de test

1. Connexion admin → `/protected/planning` → onglet Planning global.
2. S’assurer qu’une semaine a des affectations sauvegardées.
3. Clic **Exporter en PDF** → téléchargement `planning-YYYY-Www.pdf`.
4. Ouvrir le PDF : en-tête semaine, lignes d’activités, initiales médecins, notes.
5. Connexion médecin → le bouton est **absent**.
6. `curl` sans cookie → redirection/401 (middleware).

### Déploiement

- `bun add pdf-lib` puis redeploy Vercel.
- Aucune variable d’environnement nouvelle.

---

## G2 — Historique des modifications

### Description technique

- Table `schedule_history` : une ligne par **changement de cellule** (ou un snapshot compact si trop verbeux).
- **Approche recommandée** : diff côté Server Action dans `saveScheduleToDb` (avant upsert), plutôt qu’un trigger JSONB opaque — plus lisible, aligné avec `old_value` / `new_value` demandés.
- UI admin optionnelle (v1) : panneau « Historique » filtré par `week_key` (drawer dans `ScheduleApp` ou page `/protected/admin/history`).
- **Ne pas** écrire l’historique sur l’echo Realtime (G3) : uniquement sur les writes initiés localement / Server Actions.

### Base de données

```sql
-- supabase/migrations/20250725000000_create_schedule_history.sql

CREATE TABLE IF NOT EXISTS public.schedule_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_key TEXT NOT NULL,
  row_key TEXT NOT NULL,
  day_name TEXT NOT NULL,
  old_value TEXT[] NOT NULL DEFAULT '{}',
  new_value TEXT[] NOT NULL DEFAULT '{}',
  changed_by TEXT,
  changed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  source TEXT DEFAULT 'ui', -- ui | voice | pdf | csv | solver | change_request | system
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_schedule_history_week_at
  ON public.schedule_history (week_key, changed_at DESC);
CREATE INDEX idx_schedule_history_user
  ON public.schedule_history (changed_by_user_id, changed_at DESC);

ALTER TABLE public.schedule_history ENABLE ROW LEVEL SECURITY;

-- Lecture : admins uniquement (réutilise is_admin())
CREATE POLICY "Admins can read schedule_history"
  ON public.schedule_history FOR SELECT
  USING (public.is_admin());

-- Écriture : service / authenticated (Server Action avec user session)
CREATE POLICY "Authenticated can insert schedule_history"
  ON public.schedule_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

GRANT SELECT, INSERT ON public.schedule_history TO authenticated;
GRANT ALL ON public.schedule_history TO service_role;
```

> **Alternative trigger** (si vous préférez 100 % Postgres) : trigger `AFTER UPDATE OF schedule_data ON schedules` qui calcule un diff JSON. Plus fragile avec le blob `full_schedule` — **exclure** `week_key = 'full_schedule'` dans le trigger.

### Dépendances

Aucune.

### Code — diff + sauvegarde

```ts
// lib/schedule-diff.ts
import type { ScheduleData } from "@/lib/types"
import { DAYS } from "@/lib/constants"

export type CellChange = {
  row_key: string
  day_name: string
  old_value: string[]
  new_value: string[]
}

export function diffScheduleCells(
  prev: ScheduleData | null | undefined,
  next: ScheduleData,
): CellChange[] {
  const changes: CellChange[] = []
  const rowKeys = new Set([
    ...Object.keys(prev || {}),
    ...Object.keys(next || {}),
  ])
  for (const row of rowKeys) {
    for (const day of DAYS) {
      const oldV = prev?.[row]?.[day]?.value || []
      const newV = next?.[row]?.[day]?.value || []
      if (JSON.stringify(oldV) !== JSON.stringify(newV)) {
        changes.push({ row_key: row, day_name: day, old_value: oldV, new_value: newV })
      }
    }
  }
  return changes
}
```

```ts
// Dans app/actions/schedule-actions.ts — enrichir saveScheduleToDb

import { diffScheduleCells } from "@/lib/schedule-diff"

export async function saveScheduleToDb(
  weekKey: string,
  scheduleData: ScheduleData,
  updatedBy: string,
  options?: { source?: string },
) {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()

  // 1) Charger l'existant pour diff (ignorer full_schedule pour l'historique cellule)
  let prev: ScheduleData | null = null
  if (weekKey !== "full_schedule") {
    const { data: existing } = await supabase
      .from("schedules")
      .select("schedule_data")
      .eq("week_key", weekKey)
      .maybeSingle()
    prev = (existing?.schedule_data as ScheduleData) || null
  }

  // 2) Upsert (existant)
  const { data, error } = await supabase
    .from("schedules")
    .upsert(
      {
        week_key: weekKey,
        schedule_data: scheduleData,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "week_key" },
    )
    .select()
    .single()

  if (error) throw new Error(`Failed to save schedule: ${error.message}`)

  // 3) Historique
  if (weekKey !== "full_schedule") {
    const changes = diffScheduleCells(prev, scheduleData)
    if (changes.length > 0) {
      const rows = changes.map((c) => ({
        week_key: weekKey,
        row_key: c.row_key,
        day_name: c.day_name,
        old_value: c.old_value,
        new_value: c.new_value,
        changed_by: updatedBy,
        changed_by_user_id: userData?.user?.id ?? null,
        source: options?.source || "ui",
      }))
      // Chunk si > 500 cellules
      const { error: hErr } = await supabase.from("schedule_history").insert(rows)
      if (hErr) console.error("[history] insert failed", hErr)
    }
  }

  revalidatePath("/")
  return data
}
```

Passer `source` depuis les call sites :

- grille / notes → `"ui"`
- voice/PDF → `"voice"` / `"pdf"`
- solveur → `"solver"`
- `applyChangeRequest` → `"change_request"` (après G6, via `saveScheduleToDb`)

### UI minimale (v1)

```tsx
// Bouton admin → charge les 50 dernières lignes
const { data } = await supabase
  .from("schedule_history")
  .select("*")
  .eq("week_key", weekKey)
  .order("changed_at", { ascending: false })
  .limit(50)
```

### Guide de test

1. Appliquer la migration (`supabase db reset` local ou `supabase db push` / SQL Editor prod).
2. Admin : modifier une cellule → vérifier une ligne dans `schedule_history` (`old_value` / `new_value`).
3. Générer au solveur → `source = solver`, plusieurs lignes.
4. Médecin : SELECT via client → **0 ligne** (policy admin).
5. Sauvegarde `full_schedule` → **aucune** ligne d’historique.

### Déploiement

1. Migration SQL sur le projet Supabase hébergé.
2. Redeploy Vercel (code Server Action).
3. Pas de secret supplémentaire.

---

## G3 — Synchronisation automatique entre admins (Realtime)

### Description technique

- Publier la table `schedules` dans `supabase_realtime` (même pattern que `change_requests`).
- Dans `ScheduleApp`, s’abonner aux `UPDATE` (et `INSERT`) sur `schedules`.
- Quand un événement arrive pour `week_key !== 'full_schedule'` :
  - si `payload.new.updated_by` === utilisateur courant → **ignorer** (évite boucle / toast inutile) ;
  - sinon mettre à jour `fullSchedule[weekKey]` depuis `payload.new.schedule_data` ;
  - toast discret : « Planning mis à jour par {updated_by} ».
- Badge statut `Temps réel` (réutiliser le pattern de `/protected/admin/requests`).

### Base de données

```sql
-- supabase/migrations/20250725000001_enable_realtime_schedules.sql

ALTER TABLE public.schedules REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'schedules'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.schedules;
  END IF;
END $$;
```

### Dépendances

Aucune (`@supabase/supabase-js` déjà présent).

### Code — abonnement dans ScheduleApp

```tsx
// components/schedule-app.tsx (extrait)
useEffect(() => {
  if (!isAdmin) return

  const channel = supabase
    .channel("planning-schedules")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "schedules" },
      (payload) => {
        const row = payload.new as {
          week_key?: string
          schedule_data?: ScheduleData
          updated_by?: string
        } | null
        if (!row?.week_key || row.week_key === "full_schedule") return
        if (row.updated_by && row.updated_by === currentUser) return
        if (!row.schedule_data) return

        setFullSchedule((prev) => ({
          ...prev,
          [row.week_key!]: row.schedule_data!,
        }))
        toast.message(`Planning ${row.week_key} synchronisé`, {
          description: row.updated_by ? `par ${row.updated_by}` : undefined,
        })
      },
    )
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}, [supabase, isAdmin, currentUser, setFullSchedule])
```

### Points d’attention

| Risque | Mitigation |
|--------|------------|
| Boucle write → realtime → setState → re-save | Ne **jamais** re-sauver depuis le handler Realtime |
| Conflit édition simultanée | Last-write-wins (v1) ; plus tard : `version` + toast « conflit » |
| Blob `full_schedule` | Ignorer ces events ; éventuellement arrêter d’écrire le blob (G6) |
| Médecins | Pas d’abonnement (ou lecture seule sans toast) |

### Guide de test

1. Migration Realtime appliquée (Studio → Replication → `schedules` coché).
2. Deux navigateurs admin (comptes différents ou fenêtres privées).
3. Admin A modifie une cellule → Admin B voit la grille se mettre à jour **sans F5** + toast.
4. Admin A ne reçoit pas son propre toast (filtre `updated_by`).
5. Médecin : pas de canal / pas d’erreur console.

### Déploiement

1. Migration publication (prod Supabase).
2. Vérifier que Realtime est activé sur le projet.
3. Redeploy front.

---

## G4 — Import CSV / Excel

### Description technique

- Étendre `VoiceAndUploadPanel` : input `accept=".csv,.xlsx,.xls,application/pdf"`.
- PDF → flux existant `/api/upload-pdf` (Render).
- CSV/XLSX → **parse local** (pas Render) via nouvelle route `/api/import-planning` ou parse client + `onCommandExecuted` avec `mapped_existing_schedule`.
- Format attendu (hypothèse documentée dans l’UI) :

```csv
activite,LUNDI,MARDI,MERCREDI,JEUDI,VENDREDI,SAMEDI,DIMANCHE
Garde Nuit,P,H,P,H,P,CH,CH
Matin - Cs PSS,M,M,,,Z,,
```

- Colonnes jours = `DAYS` ; cellules = initiales séparées par `,` ou `|` ; lignes inconnues → warning toast, ignorées.

### Base de données

Aucune.

### Dépendances

```bash
bun add papaparse xlsx
bun add -d @types/papaparse
```

### Fichiers

| Fichier | Rôle |
|---------|------|
| `lib/planning-import.ts` | Parse CSV/XLSX → `Record<string, string[]>` ou `ScheduleData` patch |
| `app/api/import-planning/route.ts` | (optionnel) parse serveur + validation admin |
| `components/VoiceAndUploadPanel.tsx` | branchement MIME |
| `lib/guard-api-mapping.ts` | réutiliser `applyMappedExistingSchedule` |

### Code — parseur

```ts
// lib/planning-import.ts
import Papa from "papaparse"
import * as XLSX from "xlsx"
import { DAYS } from "@/lib/constants"

export function rowsToMappedSchedule(
  rows: Record<string, string>[],
): Record<string, string[]> {
  const mapped: Record<string, string[]> = {}
  for (const row of rows) {
    const activity = (row.activite || row.Activité || row.activity || "").trim()
    if (!activity) continue
    for (const day of DAYS) {
      const raw = row[day] || row[day.toLowerCase()] || ""
      const doctors = String(raw)
        .split(/[,|;/]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
      if (doctors.length) mapped[`${activity}||${day}`] = doctors
    }
  }
  return mapped
}

export function parseCsvToMapped(text: string) {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  })
  if (parsed.errors.length) {
    throw new Error(parsed.errors[0]?.message || "CSV invalide")
  }
  return rowsToMappedSchedule(parsed.data)
}

export async function parseExcelToMapped(file: ArrayBuffer) {
  const wb = XLSX.read(file, { type: "array" })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet)
  return rowsToMappedSchedule(rows)
}
```

### Code — branchement panel

```tsx
// VoiceAndUploadPanel — dans handleFile
const name = file.name.toLowerCase()
if (name.endsWith(".pdf")) {
  // flux existant /api/upload-pdf
} else if (name.endsWith(".csv")) {
  const text = await file.text()
  const mapped = parseCsvToMapped(text)
  onCommandExecuted?.({ mapped_existing_schedule: mapped })
} else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
  const buf = await file.arrayBuffer()
  const mapped = await parseExcelToMapped(buf)
  onCommandExecuted?.({ mapped_existing_schedule: mapped })
} else {
  toast.error("Formats acceptés : PDF, CSV, XLSX")
}
```

Puis dans `applyVoiceOrUploadResult` (déjà présent) : `applyMappedExistingSchedule` + `updateSchedule` avec `source: "csv"`.

### Guide de test

1. Préparer un CSV conforme (1 ligne Garde Nuit).
2. Admin → panneau vocal → upload CSV → cellules mises à jour + toast.
3. Même test XLSX.
4. PDF inchangé (proxy Render).
5. Ligne activité inconnue → planning non cassé + warning.

### Déploiement

- Ajouter packages, redeploy.
- Documenter le format CSV dans l’UI (texte d’aide sous l’input).

---

## G5 — Gestion des comptes utilisateurs

### Description technique

- Nouvelle page **`/protected/admin/users`** (guard `role === 'admin'`, même pattern que `/protected/admin/requests`).
- Fonctions (Server Actions + **service role** pour Auth Admin API) :
  - lister `profiles` ⨝ emails ;
  - créer un utilisateur (`auth.admin.createUser` + `email_confirm: true`) ;
  - mettre à jour `role`, `doctor_code`, `first_name`, `last_name` ;
  - désactiver / supprimer (`auth.admin.deleteUser`) avec confirmation.
- **Ne jamais** exposer `SUPABASE_SERVICE_ROLE_KEY` au client — uniquement Server Actions / route handlers.

### Base de données

`profiles` existe déjà. Éventuel durcissement :

```sql
-- Optionnel : empêcher un non-admin de s'auto-promouvoir
CREATE OR REPLACE FUNCTION public.prevent_role_self_escalation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Seul un admin peut changer le rôle';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_role_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_self_escalation();
```

### Dépendances

Aucune nouvelle lib. Variable d’environnement :

```env
SUPABASE_SERVICE_ROLE_KEY=...   # déjà souvent présente côté serveur ; à confirmer sur Vercel
```

Client admin serveur :

```ts
// lib/supabase/admin.ts
import { createClient } from "@supabase/supabase-js"

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY manquante")
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
```

### Code — actions (extraits)

```ts
// app/actions/admin-user-actions.ts
"use server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Non authentifié")
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (profile?.role !== "admin") throw new Error("Admin requis")
  return user
}

export async function listUsers() {
  await assertAdmin()
  const admin = createAdminClient()
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, email, first_name, last_name, role, doctor_code, created_at")
    .order("created_at", { ascending: false })
  if (error) return { success: false, error: error.message, users: [] }
  return { success: true, users: profiles }
}

export async function createUserAccount(input: {
  email: string
  password: string
  role: "admin" | "doctor"
  doctor_code?: string
  first_name?: string
  last_name?: string
}) {
  await assertAdmin()
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      first_name: input.first_name || "",
      last_name: input.last_name || "",
    },
  })
  if (error || !data.user) return { success: false, error: error?.message || "Création échouée" }

  const { error: pErr } = await admin.from("profiles").update({
    role: input.role,
    doctor_code: input.doctor_code || null,
    first_name: input.first_name || null,
    last_name: input.last_name || null,
    must_change_password: true,
  }).eq("id", data.user.id)

  if (pErr) return { success: false, error: pErr.message }
  return { success: true, userId: data.user.id }
}

export async function updateUserProfile(id: string, patch: {
  role?: "admin" | "doctor"
  doctor_code?: string | null
  first_name?: string | null
  last_name?: string | null
}) {
  await assertAdmin()
  const admin = createAdminClient()
  const { error } = await admin.from("profiles").update(patch).eq("id", id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function deleteUserAccount(id: string) {
  const me = await assertAdmin()
  if (me.id === id) return { success: false, error: "Impossible de supprimer votre propre compte" }
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}
```

### UI

- Page `app/protected/admin/users/page.tsx` : tableau + dialog création + dialog édition + `AlertDialog` suppression.
- Lien depuis le header `ScheduleApp` (admin) et/ou navbar.

### Guide de test

1. `SUPABASE_SERVICE_ROLE_KEY` configurée (local `.env` + Vercel).
2. Admin ouvre `/protected/admin/users` → liste visible.
3. Créer `test@cardiomaine.fr` / rôle doctor / code `T` → login OK → `must_change_password`.
4. Changer rôle → doctor ↔ admin.
5. Supprimer → confirmation → disparition Auth + cascade profile.
6. Médecin → accès `/protected/admin/users` → redirect / 403.

### Déploiement

1. Ajouter `SUPABASE_SERVICE_ROLE_KEY` sur Vercel (Environment Variables).
2. Ne **pas** préfixer `NEXT_PUBLIC_`.
3. Migration trigger anti-escalade (optionnelle) sur Supabase.
4. Redeploy.

---

## G6 — Corrections de bugs supplémentaires (observés)

Aucun ticket « étape F » fourni ici ; bugs / dettes constatés dans le code actuel :

### G6.1 — Désync `applyChangeRequest` vs blob `full_schedule`

**Symptôme** : approbation d’une demande met à jour la ligne semaine, mais `loadFullScheduleFromDb()` peut écraser avec un blob obsolète.

**Fix** : dans `app/actions/change-request-actions.ts`, après upsert semaine, appeler `saveScheduleToDb` (qui historise) **et** mettre à jour le blob, **ou** faire de la ligne semaine la seule source de vérité au chargement (recommandé long terme).

```ts
// Après update de la semaine dans applyChangeRequest :
await saveScheduleToDb(weekKey, updatedSchedule, "change_request")
// Option A : sync blob
const full = await loadFullScheduleFromDb()
await saveFullScheduleToDb({ ...(full || {}), [weekKey]: updatedSchedule })
```

Mieux (v2) : `planning/page.tsx` charge via `getAllSchedulesFromDb()` filtré `week_key LIKE '%-W%'` et abandonne le blob.

### G6.2 — `version` jamais incrémenté

Incrémenter dans `saveScheduleToDb` pour préparer les conflits G3 :

```ts
version: (existing?.version ?? 0) + 1
```

### G6.3 — Page `/profile` stub

Le formulaire profil ne persiste pas. Brancher un update `profiles` (self) pour `first_name` / `last_name` / avatar — hors scope critique mais UX trompeuse.

### G6.4 — Legacy `lib/schedule-save.ts`

Schéma obsolète (`user_id`) ; non importé. **Supprimer** ou marquer `@deprecated` pour éviter une réutilisation accidentelle.

### G6.5 — Toast « Planning saved successfully » (anglais)

Harmoniser les toasts en français dans `updateSchedule`.

### Guide de test G6

1. Médecin crée une demande → admin approuve → recharger planning (F5) → cellule reflète le médecin demandé.
2. Deux saves successifs → `version` augmente en SQL.
3. Plus aucune référence à `schedule-save.ts` dans le bundle.

---

## G7 — Non spécifié

Le brief mentionne **G1 à G7** mais ne détaille que **G1–G6**.

### Hypothèses possibles (à valider avec le product owner)

| Hypothèse G7 | Description courte |
|--------------|-------------------|
| **A. Undo / restauration** | Rejouer `schedule_history` pour restaurer une cellule ou une semaine |
| **B. Notifications email** | Mail admin à chaque `change_request` INSERT |
| **C. Mode hors-ligne / PWA cache** | `next-pwa` déjà présent — durcir le cache planning |
| **D. Audit export** | Export CSV de `schedule_history` |
| **E. Contraintes solveur UI** | Éditer `weekend_mode` / règles dimanche depuis l’UI |

**Action** : confirmer G7 avant implémentation. En attendant, **ne pas bloquer** G1–G3.

---

## Architecture cible (après G1–G3)

```
[ScheduleApp]
   │  edit / voice / csv / solver
   ▼
saveScheduleToDb(weekKey, data, user, { source })
   │
   ├─► schedules (UPSERT week row + version++)
   ├─► schedule_history (diff cellules)
   └─► (optionnel) full_schedule blob — à déprécier

[Supabase Realtime] ──UPDATE schedules ──► autres admins (G3)

[Export] ScheduleApp ──GET /api/export-planning-pdf──► pdf-lib (G1)
```

---

## Instructions de déploiement globales

### Migrations (ordre)

1. `20250725000000_create_schedule_history.sql` (G2)
2. `20250725000001_enable_realtime_schedules.sql` (G3)
3. (opt) trigger anti-escalade rôles (G5)

Local :

```bash
supabase db reset
# ou
supabase migration up
```

Prod : SQL Editor / `supabase db push` (selon votre flux), puis vérifier **Database → Publications → supabase_realtime**.

### Variables d’environnement (Vercel)

| Variable | Requis pour |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | déjà |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | déjà |
| `SUPABASE_SERVICE_ROLE_KEY` | **G5** |
| `GUARD_API_BASE_URL` / `GUARD_API_URL` | voice/PDF existants |
| `GUARD_API_KEY` | optionnel Render |

### Packages (`package.json`)

```bash
bun add pdf-lib          # G1
bun add papaparse xlsx   # G4
bun add -d @types/papaparse
```

### Smoke checklist post-deploy

- [ ] Export PDF admin OK ; médecin sans bouton
- [ ] Edit cellule → ligne `schedule_history`
- [ ] 2 admins : sync Realtime sans F5
- [ ] CSV import met à jour la grille
- [ ] `/protected/admin/users` CRUD + service role
- [ ] Approbation change request visible après F5 (G6.1)

---

## Estimation de découpage (sans calendrier)

| Lot | Contenu | Risque principal |
|-----|---------|------------------|
| Lot 1 | G6.1 + G6.2 + G2 migration/actions | Volume d’inserts sur génération solveur |
| Lot 2 | G3 Realtime schedules | Conflits d’édition simultanée |
| Lot 3 | G1 PDF | Mise en page dense A4 |
| Lot 4 | G4 CSV/XLSX | Variantes de format fichier métier |
| Lot 5 | G5 Users | Secrets service role + sécurité |

---

## Prochaine étape suggérée

1. Valider ce plan (et préciser **G7**).
2. Ouvrir la PR d’implémentation **Lot 1** (G6 sync + G2 history).
3. Enchaîner G3 puis G1.

Ce document vit dans `docs/PLAN-OPTIONS-G1-G7.md` et peut être ajusté au fur et à mesure des PRs.
