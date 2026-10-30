from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

from .database import get_db, get_next_sequence_value
from .routers import alquileres

# Inicialización y semillas de prueba en MongoDB
try:
    db = get_db()
    if db.alquileres.count_documents({}) == 0:
        semillas = [
            {
                "id": get_next_sequence_value("alquiler_id"),
                "habitacion_id": 1,
                "huesped_id": 1,
                "fecha_inicio": "2026-10-15",
                "fecha_fin": "2026-10-18",
                "monto": 240.00,
                "estado": "finalizado",
                "created_at": datetime.utcnow().isoformat()
            }
        ]
        db.alquileres.insert_many(semillas)
        print("[alquileres-service] Semillas de alquileres insertadas en MongoDB.")
except Exception as e:
    print(f"[alquileres-service] Error durante la inicialización de MongoDB: {e}")

app = FastAPI(
    title="Microservicio de Alquileres (UNU)",
    description="Microservicio encargado de gestionar el proceso de alquiler de habitaciones, "
                "orquestando la validación del huésped y la disponibilidad de la habitación.\n\n"
                "**Alumno Encargado:** Atencio Campos Ernesto Andres\n"
                "**Docente:** Dr. Flores Saldaña León Esteban\n"
                "**Base de Datos:** MongoDB (`db_alquileres`)",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Router
app.include_router(alquileres.router)

@app.get("/", tags=["Health"])
@app.get("/health", tags=["Health"])
def health_check():
    return {
        "service": "alquileres-service",
        "status": "UP",
        "database": "MongoDB (db_alquileres)",
        "framework": "FastAPI",
        "responsable": "Atencio Campos Ernesto Andres",
        "universidad": "Universidad Nacional de Ucayali",
        "curso": "Taller de Desarrollo",
        "timestamp": datetime.utcnow().isoformat()
    }
