# Microservicio de Alquileres (`alquileres-service`)

- **Universidad:** Universidad Nacional de Ucayali (UNU)
- **Facultad:** Escuela Profesional de Ingeniería de Sistemas
- **Curso:** Taller de Desarrollo
- **Docente:** Dr. Flores Saldaña León Esteban
- **Alumno Encargado:** Atencio Campos Ernesto Andres
- **Framework:** FastAPI (Python 3.12)
- **Base de Datos:** MongoDB NoSQL (`db_alquileres`)

---

## Responsabilidades del Microservicio
1. Orquestar el proceso de alquiler asociando un huésped con una habitación disponible (RF06).
2. Validar que la habitación se encuentre en estado **`disponible`** antes de registrar el contrato (RN01).
3. Cambiar automáticamente la disponibilidad de la habitación a **`ocupada`** tras confirmar el alquiler (RN02).
4. Revertir el estado de la habitación a **`disponible`** al finalizar el periodo de alquiler (RN03).
5. Proveer endpoints de verificación de alquileres activos por huésped y habitación para proteger la integridad del sistema (RN04).
6. Validar que la fecha de fin sea mayor o igual a la fecha de inicio (RN05).

---

## Endpoints de la API

| Método | Endpoint | Descripción | Requerimiento / Regla |
|---|---|---|---|
| `GET` | `/health` | Healthcheck y metadatos del servicio | RNF01 |
| `GET` | `/docs` | Documentación interactiva Swagger UI | - |
| `GET` | `/api/alquileres` | Listar alquileres (con datos enriquecidos de huésped y habitación) | RF07 |
| `GET` | `/api/alquileres/{id}` | Consultar detalle de un alquiler por ID | RF07 |
| `POST` | `/api/alquileres` | Registrar nuevo alquiler (Valida HTTP y sincroniza estado) | RF06, RN01, RN02, RN05 |
| `PATCH`| `/api/alquileres/{id}/finalizar` | Finalizar alquiler (Libera automáticamente la habitación) | RF08, RN03 |
| `PATCH`| `/api/alquileres/{id}/cancelar` | Cancelar alquiler y liberar habitación | RF08 |
| `GET` | `/api/alquileres/activos/habitacion/{id}` | Verifica si habitación tiene alquiler activo | RN04 |
| `GET` | `/api/alquileres/activos/huesped/{id}` | Verifica si huésped tiene alquiler activo | RN04 |
