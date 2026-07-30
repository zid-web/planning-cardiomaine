# Backend — accepter `weekend` / `ASTREINTE` (et `GARDE`)

## Symptôme front

```
422 Combinaison créneau/activité non reconnue : weekend / ASTREINTE
```

Claude renvoie souvent `slot=weekend` + `activity=ASTREINTE` pour une
astreinte samedi/dimanche. Le front mappe déjà via `resolveRowKey` →
`Astreintes ATL Matin` (puis couplage soft Matin/Midi/Nuit).

## Correctif à porter dans `guard-api-cardiomaine`

Dans la validation slot×activité de `voice_command.py` (ou équivalent) :

```python
# Accepter slot weekend pour ASTREINTE / GARDE / VACANCES / CONGE
if slot == "weekend" and activity in {"ASTREINTE", "GARDE", "VACANCES", "CONGE", "CONGES", "NCT"}:
    # OK — le front résout la row_key
    pass
```

Ou normaliser avant validation :

```python
if slot == "weekend" and activity == "ASTREINTE":
    slot = "matin"  # → Astreintes ATL Matin côté mapping
```

## Repli front (déjà livré)

`shouldUseLocalVoiceFallback` + `parseVoiceCommandLocally` appliquent la
consigne localement si Render renvoie encore 422.
