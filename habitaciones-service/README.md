# Habitaciones Service

Microservicio FastAPI + MySQL ajustado al documento `Desarrollo_Sis_Alquileres_Microservicios_2026.V1`.

## Campos implementados
`id`, `numero`, `piso`, `descripcion`, `precio`, `estado`, `fecha_creacion`.

No se incluye `fecha_actualizacion` ni `activo`, porque no forman parte del diccionario de datos indicado para habitaciones en el documento.

## 1. Preparar la base de datos
1. Abrir MySQL Workbench y conectarse al servidor local.
2. Abrir y ejecutar `db_habitaciones.sql`.
3. Los tres `INSERT` al final son datos de prueba opcionales.

## 2. Preparar el proyecto en VS Code
Desde la carpeta raíz `habitaciones-service`:

```powershell
py -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Copiar `.env.example` a `.env` y colocar la contraseña real de MySQL en `DB_PASSWORD`.

## 3. Iniciar
```powershell
uvicorn app.main:app --reload --port 8001
```

Abrir `http://127.0.0.1:8001/docs`.

## Endpoints
- `GET /health`
- `POST /habitaciones`
- `GET /habitaciones`
- `GET /habitaciones?estado=Disponible`
- `GET /habitaciones/disponibles`
- `GET /habitaciones/{habitacion_id}`
- `PUT /habitaciones/{habitacion_id}`
- `PATCH /habitaciones/{habitacion_id}/estado`
- `DELETE /habitaciones/{habitacion_id}`

## Reglas aplicadas
- Solo se admiten los estados `Disponible`, `Ocupada` y `En Mantenimiento`.
- El número de habitación es único.
- Precio y piso no pueden ser negativos.
- No se permite borrar una habitación ocupada.
- No se permite cambiar manualmente una habitación de `Ocupada` a `Disponible`; el flujo previsto es que `alquileres-service` notifique a `habitaciones-service` al finalizar el alquiler.

## Integración pendiente con alquileres-service
El documento indica comunicación HTTP/REST y que un alquiler exitoso ocupa la habitación, mientras que finalizarlo la libera. Los endpoints concretos del servicio de alquileres y su contrato HTTP no están definidos en el documento. Por eso esta entrega no inventa una URL de callback: el equipo debe acordar ese contrato e integrarlo en ambos servicios.

## Importante
La aplicación y sus consultas se han generado para el esquema descrito, pero debes probarlas contra tu instalación de MySQL. No se puede afirmar que el entorno local esté integrado hasta ejecutar las pruebas.
