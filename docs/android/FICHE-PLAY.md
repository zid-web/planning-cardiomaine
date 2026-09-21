# Fiche Play — textes et formulaires

Tout ce que la Play Console demande en texte, rédigé. À copier-coller.
Les longueurs sont vérifiées&nbsp;: voir `scripts/check-fiche-play.mjs`.

---

## Description courte (80 caractères maximum)

```
Le planning du service de cardiologie : gardes, astreintes, vacations, congés.
```

## Description complète (4000 caractères maximum)

```
Planning Cardiomaine est l'outil de planning du service de cardiologie : il
réunit sur une même grille les gardes, les astreintes, les vacations, les
coronarographies et les congés de l'équipe.

L'application est réservée aux praticiens et au personnel administratif du
service. Elle fonctionne sur compte nominatif et n'est pas destinée au public.

CE QUE L'APPLICATION FAIT

• La semaine d'un coup d'œil. La grille hebdomadaire montre qui fait quoi,
  matin et après-midi, site par site.

• La répartition des gardes. Un calcul propose une répartition qui tient compte
  des contraintes du service et de l'équité entre praticiens sur la durée, au
  lieu de la reconstituer de mémoire chaque mois.

• Les congés et les échanges. Chacun dépose ses demandes de congés ou de
  modification ; les administrateurs du planning les traitent dans
  l'application, sans passer par des courriels dispersés.

• L'export en PDF. Le planning de la semaine s'imprime tel qu'il s'affiche,
  pour l'affichage au mur du service.

• Les consignes et les notes. Les instructions de génération du planning et les
  notes du jour restent attachées à la semaine concernée.

• La dictée vocale. Les saisies peuvent se faire à la voix, ce qui va plus vite
  entre deux examens. La fonction est facultative.

CONFIDENTIALITÉ

L'application ne traite aucune donnée de patient : ni dossier médical, ni
identité de patient, ni résultat d'examen. Les seules données personnelles sont
celles des membres de l'équipe, dans le cadre de l'organisation du service.

Politique de confidentialité :
https://planning-cardiomaine.vercel.app/confidentialite

ACCÈS

L'accès est fourni par l'administrateur du planning du service. L'application
n'est pas utilisable sans compte.
```

## Catégorie et classement

| Champ | Valeur |
|---|---|
| Catégorie d'application | Médecine (ou Productivité) |
| Type | Application |
| Tags | planning, hôpital, équipe médicale |
| Public cible | 18 ans et plus |
| Contenu pour enfants | Non — l'application n'est pas destinée aux enfants |

Une TWA est de toute façon **incompatible** avec les applications visant les
moins de 13 ans (bubblewrap l'avertit à l'initialisation). Répondre « non » à
la question du public enfant n'est donc pas un choix mais une contrainte
technique.

---

## Formulaire Sécurité des données

Les réponses ci-dessous correspondent au traitement réel, relevé dans le code.
Elles doivent rester cohérentes avec la page de politique de confidentialité.

| Question | Réponse |
|---|---|
| L'application collecte-t-elle des données&nbsp;? | Oui |
| Les données sont-elles chiffrées en transit&nbsp;? | Oui |
| L'utilisateur peut-il demander la suppression de ses données&nbsp;? | Oui, par e-mail à l'adresse de contact |
| Les données sont-elles partagées avec des tiers&nbsp;? | Non — seuls des sous-traitants techniques (hébergement, calcul) |

Types de données à déclarer&nbsp;:

| Type | Collecté | Partagé | Finalité | Obligatoire |
|---|---|---|---|---|
| Nom | Oui | Non | Fonctionnalité de l'app | Oui |
| Adresse e-mail | Oui | Non | Fonctionnalité, gestion du compte | Oui |
| ID utilisateur | Oui | Non | Gestion du compte | Oui |
| Photos (photo de profil) | Oui | Non | Fonctionnalité | Non |
| Fichiers et documents | Oui | Non | Fonctionnalité — import de planning en PDF | Non |
| Enregistrements audio | **Non collecté** | — | Transcrit par le navigateur, jamais conservé par l'app | Non |
| Actions dans l'app | Oui | Non | Analyse, fonctionnalité | Non |
| Diagnostics / performance | Oui | Non | Analyse | Non |

Le point de l'audio mérite attention&nbsp;: la dictée passe par la
reconnaissance vocale **du navigateur**, qui transmet l'audio à l'éditeur du
navigateur. L'application, elle, ne reçoit et ne stocke que le texte transcrit.
Déclarer « enregistrements audio non collectés » est donc exact pour
l'application, et la politique de confidentialité explique le rôle du
navigateur — c'est cette combinaison qui est honnête.

---

## Accès à l'application

**Le point qui fait échouer l'examen le plus souvent pour cette application.**

Tout est derrière une connexion&nbsp;: un examinateur qui installe
l'application ne voit qu'un écran de connexion, et refuse la publication s'il ne
peut pas aller plus loin.

Play Console → *Règles et programmes* → *Contenu de l'application* →
**Accès à l'application** → « Tout ou partie des fonctionnalités sont
restreintes ».

Renseigner&nbsp;:

| Champ | Valeur |
|---|---|
| Nom des identifiants | Compte de démonstration |
| Nom d'utilisateur | <code>[À COMPLÉTER]</code> |
| Mot de passe | <code>[À COMPLÉTER]</code> |
| Instructions | Se connecter avec ces identifiants, puis ouvrir l'onglet « Semaine » pour voir la grille de planning. |

Créer un **compte dédié**, avec des données fictives, et ne pas le supprimer
ensuite&nbsp;: il est réutilisé à chaque mise à jour soumise.

---

## Captures d'écran

Minimum deux, format téléphone. À prendre depuis l'application installée, sur
un compte de démonstration — jamais avec de vrais noms de praticiens, une
capture de fiche Play est publique.

Les deux plus parlantes&nbsp;: la vue du jour, et la grille de la semaine en
paysage.

---

## Ce qui reste à compléter

1. Raison sociale et adresse du responsable de traitement, dans
   `app/confidentialite/page.tsx`.
2. Adresse e-mail de contact pour les demandes RGPD, au même endroit.
3. Durée de conservation retenue pour les plannings, au même endroit.
4. Régions d'hébergement de Supabase, Vercel et Render, au même endroit.
5. Identifiants du compte de démonstration, ci-dessus.
6. Les captures d'écran.
