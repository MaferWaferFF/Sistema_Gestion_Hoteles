CREATE DATABASE IF NOT EXISTS db_habitaciones
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE db_habitaciones;

CREATE TABLE IF NOT EXISTS habitaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    numero VARCHAR(10) NOT NULL UNIQUE,
    piso INT NOT NULL,
    descripcion VARCHAR(255) NULL,
    precio DECIMAL(10,2) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'Disponible',
    fecha_creacion DATE NOT NULL,
    CONSTRAINT chk_habitaciones_precio CHECK (precio >= 0),
    CONSTRAINT chk_habitaciones_piso CHECK (piso >= 0)
);

-- Datos de prueba opcionales. Ejecutar solo si se desea poblar la tabla.
INSERT INTO habitaciones (numero, piso, descripcion, precio, estado, fecha_creacion)
VALUES
    ('101', 1, 'Habitación simple', 50.00, 'Disponible', CURRENT_DATE),
    ('102', 1, 'Habitación matrimonial', 80.00, 'Disponible', CURRENT_DATE),
    ('201', 2, 'Habitación con baño privado', 100.00, 'En Mantenimiento', CURRENT_DATE);
