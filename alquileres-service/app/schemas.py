from pydantic import BaseModel, Field, field_validator
from typing import Optional, Any, Dict
from datetime import date, datetime

class AlquilerBase(BaseModel):
    habitacion_id: int = Field(..., example=1, description="ID de la habitación en habitaciones-service")
    huesped_id: int = Field(..., example=1, description="ID del huésped en huespedes-service")
    fecha_inicio: date = Field(..., example="2026-10-21", description="Fecha de inicio del alquiler (YYYY-MM-DD)")
    fecha_fin: Optional[date] = Field(None, example="2026-10-25", description="Fecha de fin opcional (YYYY-MM-DD)")
    monto: float = Field(..., example=320.00, description="Monto acordado para el alquiler")
    estado: Optional[str] = Field("vigente", example="vigente", description="Estado: vigente, finalizado, cancelado")

    @field_validator("fecha_fin")
    @classmethod
    def validar_fechas(cls, v, info):
        # RN05: La fecha de fin debe ser estrictamente posterior o igual a la fecha de inicio
        fecha_inicio = info.data.get("fecha_inicio")
        if v and fecha_inicio and v < fecha_inicio:
            raise ValueError("RN05: La fecha de fin debe ser estrictamente posterior o igual a la fecha de inicio registrada.")
        return v

class AlquilerCreate(AlquilerBase):
    pass

class AlquilerUpdate(BaseModel):
    fecha_fin: Optional[date] = Field(None, example="2026-10-26")
    monto: Optional[float] = Field(None, example=350.00)
    estado: Optional[str] = Field(None, example="vigente")

class AlquilerResponse(BaseModel):
    id: int
    habitacion_id: int
    huesped_id: int
    fecha_inicio: str
    fecha_fin: Optional[str] = None
    monto: float
    estado: str
    created_at: Optional[str] = None
    habitacion_detalle: Optional[Dict[str, Any]] = None
    huesped_detalle: Optional[Dict[str, Any]] = None
