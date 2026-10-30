from fastapi import APIRouter, HTTPException, Query, status
from typing import List, Optional
import os
from datetime import datetime
import httpx

from ..database import get_db, get_next_sequence_value
from ..schemas import AlquilerCreate, AlquilerUpdate, AlquilerResponse

router = APIRouter(prefix="/api/alquileres", tags=["Alquileres"])

HABITACIONES_SERVICE_URL = os.getenv("HABITACIONES_SERVICE_URL", "http://localhost:8001")
HUESPEDES_SERVICE_URL = os.getenv("HUESPEDES_SERVICE_URL", "http://localhost:8082")

def extraer_datos_huesped(raw_huesped):
    """
    Desempaqueta el payload si el microservicio de huéspedes lo retorna envuelto en ApiResponse:
    { "success": true, "message": "...", "data": { ... } }
    """
    if isinstance(raw_huesped, dict) and "data" in raw_huesped and raw_huesped["data"] is not None:
        return raw_huesped["data"]
    return raw_huesped

def format_doc(doc, habitacion=None, huesped=None):
    return {
        "id": doc.get("id"),
        "habitacion_id": doc.get("habitacion_id"),
        "huesped_id": doc.get("huesped_id"),
        "fecha_inicio": str(doc.get("fecha_inicio")),
        "fecha_fin": str(doc.get("fecha_fin")) if doc.get("fecha_fin") else None,
        "monto": float(doc.get("monto")),
        "estado": doc.get("estado"),
        "created_at": str(doc.get("created_at")),
        "habitacion_detalle": habitacion,
        "huesped_detalle": extraer_datos_huesped(huesped) if huesped else None
    }

# RN04: Endpoint para verificar si una habitación tiene un alquiler activo/vigente
@router.get("/activos/habitacion/{habitacion_id}", summary="Verificar si habitación tiene alquiler activo (RN04)")
def tiene_alquiler_activo_habitacion(habitacion_id: int):
    db = get_db()
    count = db.alquileres.count_documents({
        "habitacion_id": habitacion_id,
        "estado": "vigente"
    })
    return {"habitacion_id": habitacion_id, "tieneAlquilerActivo": count > 0}

# RN04: Endpoint para verificar si un huésped tiene un alquiler activo/vigente
@router.get("/activos/huesped/{huesped_id}", summary="Verificar si huésped tiene alquiler activo (RN04)")
def tiene_alquiler_activo_huesped(huesped_id: int):
    db = get_db()
    count = db.alquileres.count_documents({
        "huesped_id": huesped_id,
        "estado": "vigente"
    })
    return {"huesped_id": huesped_id, "tieneAlquilerActivo": count > 0}

# RF07: Consultar los alquileres registrados y su estado
@router.get("", response_model=List[AlquilerResponse], summary="Listar alquileres")
def listar_alquileres(
    estado: Optional[str] = Query(None, description="Filtrar por estado: vigente, finalizado, cancelado"),
    incluir_detalles: bool = Query(True, description="Enriquecer respuesta con datos de habitaciones y huéspedes vía HTTP")
):
    db = get_db()
    filtro = {}
    if estado:
        filtro["estado"] = estado.lower()

    cursor = db.alquileres.find(filtro).sort("id", 1)
    alquileres = list(cursor)

    resultados = []
    with httpx.Client(timeout=4.0) as client:
        for alq in alquileres:
            hab_detalle = None
            hue_detalle = None
            if incluir_detalles:
                try:
                    resp_h = client.get(f"{HABITACIONES_SERVICE_URL}/api/habitaciones/{alq['habitacion_id']}")
                    if resp_h.status_code == 200:
                        hab_detalle = resp_h.json()
                except Exception:
                    pass

                try:
                    resp_u = client.get(f"{HUESPEDES_SERVICE_URL}/api/huespedes/{alq['huesped_id']}")
                    if resp_u.status_code == 200:
                        hue_detalle = resp_u.json()
                except Exception:
                    pass

            resultados.append(format_doc(alq, hab_detalle, hue_detalle))

    return resultados

# RF07: Consultar un alquiler por ID
@router.get("/{id}", response_model=AlquilerResponse, summary="Consultar alquiler por ID")
def obtener_alquiler(id: int):
    db = get_db()
    doc = db.alquileres.find_one({"id": id})
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alquiler con ID {id} no encontrado"
        )

    hab_detalle = None
    hue_detalle = None
    with httpx.Client(timeout=4.0) as client:
        try:
            resp_h = client.get(f"{HABITACIONES_SERVICE_URL}/api/habitaciones/{doc['habitacion_id']}")
            if resp_h.status_code == 200:
                hab_detalle = resp_h.json()
        except Exception:
            pass

        try:
            resp_u = client.get(f"{HUESPEDES_SERVICE_URL}/api/huespedes/{doc['huesped_id']}")
            if resp_u.status_code == 200:
                hue_detalle = resp_u.json()
        except Exception:
            pass

    return format_doc(doc, hab_detalle, hue_detalle)

# RF06: Registrar un alquiler asociando un huésped con una habitación disponible
@router.post("", response_model=AlquilerResponse, status_code=status.HTTP_201_CREATED, summary="Registrar nuevo alquiler")
def crear_alquiler(payload: AlquilerCreate):
    db = get_db()

    # Validación RN05 ya se ejecuta en el esquema Pydantic (fecha_fin >= fecha_inicio)

    with httpx.Client(timeout=5.0) as client:
        # 1. Validar existencia y estado activo del huésped en huespedes-service
        try:
            resp_huesped = client.get(f"{HUESPEDES_SERVICE_URL}/api/huespedes/{payload.huesped_id}")
            if resp_huesped.status_code == 404:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"El huésped con ID {payload.huesped_id} no existe en el sistema de huéspedes."
                )
            elif resp_huesped.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Error al comunicar con el microservicio de huéspedes."
                )
            raw_huesped = resp_huesped.json()
            huesped_data = extraer_datos_huesped(raw_huesped)

            # Validar si el huésped está dado de baja lógica
            if huesped_data.get("estadoLogico") is False:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"El huésped ID {payload.huesped_id} se encuentra inactivo (dado de baja lógica). No se le puede registrar un alquiler."
                )
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"No se pudo conectar con el microservicio de huéspedes: {exc}"
            )

        # 2. Validar existencia y disponibilidad de la habitación en habitaciones-service (RN01)
        try:
            resp_hab = client.get(f"{HABITACIONES_SERVICE_URL}/api/habitaciones/{payload.habitacion_id}")
            if resp_hab.status_code == 404:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"La habitación con ID {payload.habitacion_id} no existe en el catálogo."
                )
            elif resp_hab.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Error al comunicar con el microservicio de habitaciones."
                )
            hab_data = resp_hab.json()
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"No se pudo conectar con el microservicio de habitaciones: {exc}"
            )

        # RN01: Una habitación solo puede asociarse si su estado actual es 'disponible'
        if hab_data.get("estado", "").lower() != "disponible":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"RN01: La habitación {hab_data.get('numero')} no está disponible (Estado actual: '{hab_data.get('estado')}'). Solo habitaciones 'disponible' pueden alquilarse."
            )

        # 3. Guardar el nuevo alquiler en MongoDB
        nuevo_id = get_next_sequence_value("alquiler_id")
        doc_alquiler = {
            "id": nuevo_id,
            "habitacion_id": payload.habitacion_id,
            "huesped_id": payload.huesped_id,
            "fecha_inicio": payload.fecha_inicio.isoformat(),
            "fecha_fin": payload.fecha_fin.isoformat() if payload.fecha_fin else None,
            "monto": payload.monto,
            "estado": "vigente",
            "created_at": datetime.utcnow().isoformat()
        }
        db.alquileres.insert_one(doc_alquiler)

        # 4. RN02: Actualizar automáticamente el estado de la habitación a 'Ocupada'
        try:
            resp_patch = client.patch(
                f"{HABITACIONES_SERVICE_URL}/api/habitaciones/{payload.habitacion_id}/estado",
                json={"estado": "Ocupada"}
            )
            if resp_patch.status_code != 200:
                # Compensación en caso de fallo
                db.alquileres.delete_one({"id": nuevo_id})
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Fallo al sincronizar el estado de la habitación a 'Ocupada'. La transacción fue revertida."
                )
            hab_data_actualizada = resp_patch.json()
        except httpx.RequestError as exc:
            db.alquileres.delete_one({"id": nuevo_id})
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Fallo de comunicación con habitaciones-service al actualizar estado: {exc}"
            )

    return format_doc(doc_alquiler, hab_data_actualizada, huesped_data)

# RF08 & RN03: Finalizar alquiler y liberar habitación a 'Disponible'
@router.patch("/{id}/finalizar", response_model=AlquilerResponse, summary="Finalizar alquiler (RN03: Libera habitación)")
def finalizar_alquiler(id: int):
    db = get_db()
    alquiler = db.alquileres.find_one({"id": id})
    if not alquiler:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alquiler con ID {id} no encontrado"
        )

    if alquiler.get("estado") == "finalizado":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El alquiler ya se encuentra en estado 'finalizado'."
        )

    # Actualizar estado a finalizado
    db.alquileres.update_one(
        {"id": id},
        {"$set": {"estado": "finalizado", "fecha_fin": datetime.utcnow().date().isoformat()}}
    )
    alquiler_actualizado = db.alquileres.find_one({"id": id})

    # RN03: Al finalizar un alquiler, el estado de la habitación debe actualizarse a 'Disponible'
    hab_detalle = None
    with httpx.Client(timeout=5.0) as client:
        try:
            resp = client.patch(
                f"{HABITACIONES_SERVICE_URL}/api/habitaciones/{alquiler['habitacion_id']}/estado",
                json={"estado": "Disponible"}
            )
            if resp.status_code == 200:
                hab_detalle = resp.json()
        except httpx.RequestError as exc:
            print(f"[alquileres-service] Advertencia: No se pudo actualizar estado de habitación {alquiler['habitacion_id']} a 'Disponible': {exc}")

    return format_doc(alquiler_actualizado, hab_detalle)

# Cancelar alquiler
@router.patch("/{id}/cancelar", response_model=AlquilerResponse, summary="Cancelar alquiler")
def cancelar_alquiler(id: int):
    db = get_db()
    alquiler = db.alquileres.find_one({"id": id})
    if not alquiler:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alquiler con ID {id} no encontrado"
        )

    db.alquileres.update_one({"id": id}, {"$set": {"estado": "cancelado"}})
    alquiler_actualizado = db.alquileres.find_one({"id": id})

    # Liberar habitación si estaba vigente
    if alquiler.get("estado") == "vigente":
        with httpx.Client(timeout=5.0) as client:
            try:
                client.patch(
                    f"{HABITACIONES_SERVICE_URL}/api/habitaciones/{alquiler['habitacion_id']}/estado",
                    json={"estado": "Disponible"}
                )
            except Exception:
                pass

    return format_doc(alquiler_actualizado)
