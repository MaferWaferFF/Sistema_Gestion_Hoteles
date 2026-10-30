from datetime import date
from decimal import Decimal
from typing import Optional
from fastapi import FastAPI, APIRouter, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from mysql.connector import Error, IntegrityError
from app.database import get_connection
from app.schemas import HabitacionCrear, HabitacionActualizar, HabitacionEstado, normalizar_estado

app = FastAPI(
    title="Habitaciones Service",
    description="Microservicio de habitaciones alineado con el documento del proyecto de alquileres.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CAMPOS = "id, numero, piso, descripcion, precio, estado, fecha_creacion"

def fila_a_dict(row):
    if row is None:
        return None
    return {
        "id": row[0],
        "numero": row[1],
        "piso": row[2],
        "descripcion": row[3],
        "precio": Decimal(str(row[4])),
        "estado": row[5],
        "fecha_creacion": row[6],
    }

def ejecutar_consulta(sql, params=(), fetchone=False, fetchall=False, commit=False):
    conn = None
    cursor = None
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(sql, params)
        result = cursor.fetchone() if fetchone else cursor.fetchall() if fetchall else None
        if commit:
            conn.commit()
        return result, cursor.lastrowid
    except IntegrityError as exc:
        if conn:
            conn.rollback()
        if "Duplicate" in str(exc):
            raise HTTPException(status_code=409, detail="Ya existe una habitación con ese número.")
        raise HTTPException(status_code=400, detail="No se pudo guardar el registro.")
    except Error as exc:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=503, detail=f"Error de base de datos: {exc.msg}")
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok", "servicio": "habitaciones-service"}

# Router principal para habitaciones
router = APIRouter(prefix="/habitaciones", tags=["Habitaciones"])

@router.post("", status_code=201)
def crear_habitacion(datos: HabitacionCrear):
    sql = """INSERT INTO habitaciones
        (numero, piso, descripcion, precio, estado, fecha_creacion)
        VALUES (%s, %s, %s, %s, %s, %s)"""
    _, new_id = ejecutar_consulta(
        sql,
        (datos.numero, datos.piso, datos.descripcion, datos.precio,
         datos.estado, datos.fecha_creacion),
        commit=True,
    )
    row, _ = ejecutar_consulta(
        f"SELECT {CAMPOS} FROM habitaciones WHERE id = %s",
        (new_id,), fetchone=True,
    )
    return fila_a_dict(row)

@router.get("")
def listar_habitaciones(
    estado: Optional[str] = Query(default=None, description="Disponible, Ocupada o En Mantenimiento")
):
    estados = ("Disponible", "Ocupada", "En Mantenimiento")
    if estado is not None:
        estado = normalizar_estado(estado)
        if estado not in estados:
            raise HTTPException(status_code=422, detail=f"Estado inválido. Use uno de: {', '.join(estados)}.")
    
    if estado:
        rows, _ = ejecutar_consulta(
            f"SELECT {CAMPOS} FROM habitaciones WHERE estado = %s ORDER BY id",
            (estado,), fetchall=True,
        )
    else:
        rows, _ = ejecutar_consulta(
            f"SELECT {CAMPOS} FROM habitaciones ORDER BY id", fetchall=True
        )
    return [fila_a_dict(row) for row in rows]

@router.get("/disponibles")
def listar_disponibles():
    rows, _ = ejecutar_consulta(
        f"SELECT {CAMPOS} FROM habitaciones WHERE estado = %s ORDER BY id",
        ("Disponible",), fetchall=True,
    )
    return [fila_a_dict(row) for row in rows]

@router.get("/{habitacion_id}")
def obtener_habitacion(habitacion_id: int):
    row, _ = ejecutar_consulta(
        f"SELECT {CAMPOS} FROM habitaciones WHERE id = %s",
        (habitacion_id,), fetchone=True,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Habitación no encontrada.")
    return fila_a_dict(row)

@router.put("/{habitacion_id}")
def actualizar_habitacion(habitacion_id: int, datos: HabitacionActualizar):
    actual, _ = ejecutar_consulta(
        f"SELECT {CAMPOS} FROM habitaciones WHERE id = %s",
        (habitacion_id,),
        fetchone=True,
    )

    if not actual:
        raise HTTPException(
            status_code=404,
            detail="Habitación no encontrada."
        )

    cambios = datos.model_dump(exclude_unset=True)

    if not cambios:
        raise HTTPException(
            status_code=400,
            detail="Debes enviar al menos un campo para actualizar."
        )

    if actual[5] == "Ocupada" and cambios.get("estado") == "Disponible":
        raise HTTPException(
            status_code=409,
            detail="Usa el endpoint de estado para liberar la habitación."
        )

    campos_permitidos = {
        "numero", "piso", "descripcion", "precio", "estado"
    }

    campos = [
        campo for campo in cambios
        if campo in campos_permitidos
    ]

    sql = (
        "UPDATE habitaciones SET "
        + ", ".join(f"{campo}=%s" for campo in campos)
        + " WHERE id=%s"
    )

    valores = [cambios[campo] for campo in campos]
    valores.append(habitacion_id)

    ejecutar_consulta(sql, tuple(valores), commit=True)

    row, _ = ejecutar_consulta(
        f"SELECT {CAMPOS} FROM habitaciones WHERE id = %s",
        (habitacion_id,),
        fetchone=True,
    )
    return fila_a_dict(row)

@router.patch("/{habitacion_id}/estado")
def actualizar_estado(habitacion_id: int, datos: HabitacionEstado):
    row, _ = ejecutar_consulta(
        f"SELECT {CAMPOS} FROM habitaciones WHERE id = %s",
        (habitacion_id,), fetchone=True,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Habitación no encontrada.")
    ejecutar_consulta(
        "UPDATE habitaciones SET estado=%s WHERE id=%s",
        (datos.estado, habitacion_id), commit=True,
    )
    updated, _ = ejecutar_consulta(
        f"SELECT {CAMPOS} FROM habitaciones WHERE id = %s",
        (habitacion_id,), fetchone=True,
    )
    return fila_a_dict(updated)

@router.delete("/{habitacion_id}")
def eliminar_habitacion(habitacion_id: int):
    row, _ = ejecutar_consulta(
        f"SELECT {CAMPOS} FROM habitaciones WHERE id = %s",
        (habitacion_id,), fetchone=True,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Habitación no encontrada.")
    if row[5] == "Ocupada":
        raise HTTPException(
            status_code=409,
            detail="No se puede eliminar una habitación ocupada. Primero debe finalizarse el alquiler asociado."
        )
    ejecutar_consulta("DELETE FROM habitaciones WHERE id = %s", (habitacion_id,), commit=True)
    return {"mensaje": "Habitación eliminada.", "id": habitacion_id}

# Incluir router con y sin prefijo /api para garantizar compatibilidad total
app.include_router(router, prefix="")
app.include_router(router, prefix="/api")
