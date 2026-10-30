import os
import time
# pyrefly: ignore[missing-import]
from pymongo import MongoClient

MONGO_URI = os.getenv("MONGO_URI", "mongodb://db-alquileres:27017")
DB_NAME = os.getenv("DB_NAME", "db_alquileres")

client = None
db = None

# Reintentos de conexión
for attempt in range(1, 15):
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=3000)
        # Test ping
        client.admin.command('ping')
        print(f"[alquileres-service] Conectado exitosamente a MongoDB ({DB_NAME})")
        db = client[DB_NAME]
        break
    except Exception as e:
        print(f"[alquileres-service] Esperando a MongoDB... Intento {attempt}/15. ({e})")
        time.sleep(3)

if db is None:
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]

def get_db():
    return db

def get_next_sequence_value(sequence_name: str) -> int:
    """Generador atómico de ID numérico secuencial en MongoDB para mantener compatibilidad con el reporte UNU."""
    counters = db["counters"]
    counter = counters.find_one_and_update(
        {"_id": sequence_name},
        {"$inc": {"sequence_value": 1}},
        upsert=True,
        return_document=True
    )
    return counter["sequence_value"]
