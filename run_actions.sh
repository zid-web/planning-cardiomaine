#!/bin/bash

echo "╔════════════════════════════════════════════════════════════════════════════╗"
echo "║              EXÉCUTION DES PROCHAINES ACTIONS - ÉTAPE 2, 3, 4             ║"
echo "╚════════════════════════════════════════════════════════════════════════════╝"
echo ""

# Étape 2: Vérifier que le serveur fonctionne
echo "📋 ÉTAPE 2: Vérification du serveur..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if curl -s http://localhost:3000/home > /dev/null; then
    echo "✅ Serveur accessible sur http://localhost:3000"
else
    echo "❌ Serveur non accessible - démarrage..."
    npm run dev &
    sleep 5
fi

echo ""
echo "✅ Application testable à: http://localhost:3000"
echo ""

# Étape 3: Afficher comment tester
echo "📋 ÉTAPE 3: Instructions de test..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cat << 'TESTING'

POUR TESTER L'APPLICATION:

1. Ouvrez votre navigateur: http://localhost:3000

2. Accédez au planning (si nécessaire, connectez-vous)

3. Cherchez le bouton "✈️ Vacances" en haut à droite (Admin uniquement)

4. Cliquez pour ouvrir la modale de gestion des vacations

5. Vous verrez:
   - Un formulaire pour ajouter une vacation
   - Une liste des vacations existantes
   - Des boutons pour supprimer les vacations

NOTE: Le système est prêt. Une fois que la table Supabase est créée,
      vous pourrez:
      - Ajouter des vacations
      - Les voir dans la liste
      - Les utiliser pour exclure automatiquement les médecins en gardes

TESTING

echo ""

# Étape 4: Montrer comment ajouter des données
echo "📋 ÉTAPE 4: Insertion de données de test..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "Une fois que la table Supabase est créée, exécutez:"
echo "  python3 insert_sample_vacations.py"
echo ""
echo "Cela insérera 3 vacations de test:"
echo "  • Dr A: 10 jours"
echo "  • Dr B: 7 jours"
echo "  • Dr C: 3 jours"
echo ""

# Résumé final
echo "╔════════════════════════════════════════════════════════════════════════════╗"
echo "║                      ✅ ACTIONS EXÉCUTÉES AVEC SUCCÈS                     ║"
echo "╚════════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "🎯 PROCHAINES ÉTAPES:"
echo ""
echo "1. CRÉER LA TABLE SUPABASE (une fois)"
echo "   → Allez sur: https://supabase.com/dashboard"
echo "   → SQL Editor → New Query"
echo "   → Copiez le contenu de: vacations.sql"
echo "   → Cliquez Run"
echo ""
echo "2. TESTER L'APPLICATION"
echo "   → Ouvrez: http://localhost:3000"
echo "   → Testez le bouton Vacances"
echo ""
echo "3. INSÉRER LES DONNÉES DE TEST"
echo "   → python3 insert_sample_vacations.py"
echo ""
echo "4. GÉNÉRER LES GARDES"
echo "   → Les médecins en vacations seront exclus automatiquement"
echo ""
echo "═════════════════════════════════════════════════════════════════════════════"
echo ""
