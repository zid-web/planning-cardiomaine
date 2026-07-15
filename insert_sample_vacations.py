#!/usr/bin/env python3
"""
Script pour insérer des données de test dans Supabase
Utilise l'API REST au lieu de SQL directement
"""

import requests
import json
import os
from datetime import datetime, timedelta

# Configuration Supabase
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Erreur: Variables d'environnement SUPABASE manquantes")
    print("NEXT_PUBLIC_SUPABASE_URL:", SUPABASE_URL)
    print("NEXT_PUBLIC_SUPABASE_ANON_KEY:", "***" if SUPABASE_KEY else "NOT SET")
    exit(1)

# URL de l'API REST
REST_URL = f"{SUPABASE_URL}/rest/v1"
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

# Données d'exemple
DOCTORS = ["Dr A", "Dr B", "Dr C", "Dr D"]

def insert_vacation(doctor_id, start_date, end_date, reason):
    """Insérer une vacation via l'API REST"""
    url = f"{REST_URL}/doctor_vacations"
    
    payload = {
        "doctor_id": doctor_id,
        "start_date": start_date,
        "end_date": end_date,
        "reason": reason
    }
    
    try:
        response = requests.post(url, json=payload, headers=HEADERS)
        
        if response.status_code in [200, 201]:
            print(f"✅ Vacation ajoutée: {doctor_id} du {start_date} au {end_date}")
            return True
        else:
            print(f"❌ Erreur {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Exception: {str(e)}")
        return False

def main():
    print("\n📊 Insertion de données de test Vacations\n")
    
    # Données de test
    today = datetime.now().date()
    test_data = [
        ("Dr A", today + timedelta(days=10), today + timedelta(days=17), "Vacances d'été"),
        ("Dr B", today + timedelta(days=15), today + timedelta(days=22), "Congés"),
        ("Dr C", today + timedelta(days=5), today + timedelta(days=8), "Absence"),
    ]
    
    success_count = 0
    for doctor_id, start_date, end_date, reason in test_data:
        if insert_vacation(
            doctor_id,
            start_date.isoformat(),
            end_date.isoformat(),
            reason
        ):
            success_count += 1
    
    print(f"\n✅ {success_count}/{len(test_data)} vacations insérées avec succès")

if __name__ == "__main__":
    main()
