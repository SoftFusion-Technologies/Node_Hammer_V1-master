// validators.js
export function validateData(data) {
  console.log('Datos recibidos para validación:', data);

  if (!data || !Array.isArray(data)) {
    throw new Error('Data must be a non-empty array');
  }

  return data
    .map((item) => ({
      ...item,
      precio: parseFloat(item.precio) || 0, // Manejar casos donde parseFloat puede resultar NaN
      descuento: parseFloat(item.descuento) || 0,
      preciofinal: parseFloat(item.preciofinal) || 0,
      fechaCreacion: item.fechaCreacion
        ? new Date(item.fechaCreacion)
        : new Date()
    }))
    .filter(
      (item) =>
        // item.id_conv &&
        item.nombre &&
        item.telefono &&
        item.dni &&
        item.email &&
        typeof item.precio === 'number' &&
        typeof item.descuento === 'number' &&
        typeof item.preciofinal === 'number' &&
        item.userName &&
        item.fechaCreacion
    );
}
