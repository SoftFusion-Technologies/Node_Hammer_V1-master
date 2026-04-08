/*
 * Programador: Sergio Gustavo Manrique
 * Fecha Creación: 06 / 03 / 2026
 * Versión: 1.0
 *
 * Descripción:
 * * Este archivo contiene los controladores para las operaciones CRUD de credenciales faciales.
 * * Gestiona el almacenamiento y actualización de descriptores faciales para la validación biométrica.
 * Tema: Controladores - RRHH Credenciales Faciales
 * * Capa: Backend 
 *
 * Nomenclatura: 
 * * OBR_ obtenerRegistro (por id_usuario)
 * * OBRS_ obtenerRegistros (plural)
 * * CR_ crearRegistro
 * * UR_ actualizarRegistro (por id_usuario)
 * * ER_ eliminarRegistro (Físico)
 */

// 1. CAMBIO AQUI: Importación del nuevo modelo de credenciales faciales
import RRHHCredencialesFacialesModel from '../../Models/RRHH/MD_TB_RRHH_CredencialesFaciales.js';

// Mostrar todos los registros de credenciales faciales
export const OBRS_RRHH_CredencialesFaciales_CTS = async (req, res) => {
  try {
    const registros = await RRHHCredencialesFacialesModel.findAll();
    res.json(registros);
  } catch (error) {
    console.error('Error al obtener credenciales:', error);
    res.status(500).json({ mensajeError: 'Error al obtener credenciales' });
  }
};

// Mostrar una credencial específica por ID de usuario
export const OBR_RRHH_CredencialPorUsuario_CTS = async (req, res) => {
  try {
    // 2. CAMBIO AQUI: Búsqueda filtrada por id_usuario para validación en el login
    const registro = await RRHHCredencialesFacialesModel.findOne({
      where: { id_usuario: req.params.id_usuario }
    });
    console.log('Registro encontrado para id_usuario:', registro);
    res.json(registro);
  } catch (error) {
    console.error('Error al obtener credencial por usuario:', error);
    res.json({ mensajeError: error.message });
  }
};

// Crear un nuevo registro de credencial facial
export const CR_RRHH_CredencialesFaciales_CTS = async (req, res) => {
  try {
    // 3. CAMBIO AQUI: El cuerpo del request debe contener id_usuario y descriptor_facial
    const registro = await RRHHCredencialesFacialesModel.create(req.body);
    res.json({ message: 'Credencial facial registrada correctamente' });
  } catch (error) {
    console.error('Error al crear credencial facial:', error);
    res.json({ mensajeError: error.message });
  }
};

// Actualizar una credencial facial por el ID de usuario
export const UR_RRHH_CredencialesFaciales_CTS = async (req, res) => {
  try {
    const { id } = req.params; // Este 'id' ahora representará al id_usuario
    
    const [filasActualizadas] = await RRHHCredencialesFacialesModel.update(req.body, {
      where: { id_usuario: id } // Buscamos por la columna id_usuario
    });

    if (filasActualizadas === 1) {
      // Buscamos el registro por el id_usuario para devolverlo
      const registroActualizado = await RRHHCredencialesFacialesModel.findOne({
        where: { id_usuario: id }
      });
      
      res.json({
        message: 'Credencial actualizada correctamente',
        registroActualizado
      });
    } else {
      res.status(404).json({ mensajeError: 'Credencial no encontrada para este usuario' });
    }
  } catch (error) {
    console.error('Error al actualizar credencial facial:', error);
    res.status(500).json({ mensajeError: error.message });
  }
};

// Eliminar (desactivar) una credencial facial por su ID
export const ER_RRHH_CredencialesFaciales_CTS = async (req, res) => {
  try {
    // 5. CAMBIO AQUI: Eliminación física del registro según la política de la tabla
    await RRHHCredencialesFacialesModel.destroy({ 
      where: { id_credencial: req.params.id } 
    });
    res.json({ message: 'Credencial eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar credencial facial:', error);
    res.json({ mensajeError: error.message });
  }
};