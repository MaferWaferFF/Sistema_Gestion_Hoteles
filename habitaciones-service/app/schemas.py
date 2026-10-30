from datetime import date
from decimal import Decimal
from typing import Literal, Optional
from pydantic import BaseModel, Field, ConfigDict, field_validator

EstadoHabitacion = Literal["Disponible", "Ocupada", "En Mantenimiento"]

def normalizar_estado(v):
    if isinstance(v, str):
        mapping = {
            "disponible": "Disponible",
            "ocupada": "Ocupada",
            "en mantenimiento": "En Mantenimiento",
            "en_mantenimiento": "En Mantenimiento"
        }
        return mapping.get(v.strip().lower(), v)
    return v

class HabitacionCrear(BaseModel):
    numero: str = Field(min_length=1, max_length=10)
    piso: int = Field(ge=0)
    descripcion: Optional[str] = Field(default=None, max_length=255)
    precio: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    estado: EstadoHabitacion = "Disponible"
    fecha_creacion: date

    @field_validator("estado", mode="before")
    @classmethod
    def validar_estado(cls, v):
        return normalizar_estado(v)


class HabitacionActualizar(BaseModel):
    numero: Optional[str] = Field(default=None, min_length=1, max_length=10)
    piso: Optional[int] = Field(default=None, ge=0)
    descripcion: Optional[str] = Field(default=None, max_length=255)
    precio: Optional[Decimal] = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    estado: Optional[EstadoHabitacion] = None

    @field_validator("estado", mode="before")
    @classmethod
    def validar_estado(cls, v):
        return normalizar_estado(v) if v is not None else None


class HabitacionEstado(BaseModel):
    estado: EstadoHabitacion

    @field_validator("estado", mode="before")
    @classmethod
    def validar_estado(cls, v):
        return normalizar_estado(v)

class HabitacionRespuesta(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    numero: str
    piso: int
    descripcion: Optional[str]
    precio: Decimal
    estado: EstadoHabitacion
    fecha_creacion: date
