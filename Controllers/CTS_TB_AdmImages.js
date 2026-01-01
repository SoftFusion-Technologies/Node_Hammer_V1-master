/*
  * Programador: Benjamin Orellana
  * Fecha Cración: 25/08/2024
  * Versión: 1.0
  *
  * Descripción:
    *Este archivo (CTS_TB_AdmConveniosImages.js) contiene controladores para manejar operaciones CRUD en el modelo Sequelize de adm_convenio_images.
  * Tema: Controladores - AdmConveniosImages
  
  * Capa: Backend 
 
  * Nomenclatura: OBR_ obtenerRegistro
  *               OBRS_obtenerRegistros(plural)
  *               CR_ crearRegistro
  *               ER_ eliminarRegistro
*/

// Importa el modelo necesario
import MD_TB_AdmConveniosImages from '../Models/MT_TB_AdmImages.js';

const AdmConveniosImages = MD_TB_AdmConveniosImages.AdmConveniosImages;

// ----------------------------------------------------------------
// Controladores para operaciones CRUD en la tabla 'adm_convenio_images'
// ----------------------------------------------------------------

// Mostrar todos los registros de la tabla adm_convenio_images
export const OBRS_AdmConveniosImages_CTS = async (req, res) => {
  try {
    const registros = await AdmConveniosImages.findAll();
    res.json(registros);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Mostrar un registro específico de adm_convenio_images por su ID
export const OBR_AdmConveniosImages_CTS = async (req, res) => {
  try {
    const registro = await AdmConveniosImages.findByPk(req.params.id);
    if (registro) {
      res.json(registro);
    } else {
      res.status(404).json({ mensajeError: 'Registro no encontrado' });
    }
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Crear un nuevo registro en adm_convenio_images
export const CR_AdmConveniosImages_CTS = async (req, res) => {
  try {
    const registro = await AdmConveniosImages.create(req.body);
    res.json({ message: 'Imagen creada correctamente', registro });
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};

// Eliminar un registro en adm_convenio_images por su ID
// + borrar también el registro en convenios_mes_acciones asociado al comprobante
// Benjamin Orellana - 01/01/2026
export const ER_AdmConveniosImages_CTS = async (req, res) => {
  const sequelize = AdmConveniosImages.sequelize;
  const t = await sequelize.transaction();

  try {
    const id = Number(req.params.id || 0);
    if (!Number.isFinite(id) || id <= 0) {
      await t.rollback();
      return res.status(400).json({ mensajeError: 'ID inválido.' });
    }

    // 1) Traer la imagen (para saber convenio_id y created_at)
    const registro = await AdmConveniosImages.findByPk(id, { transaction: t });
    if (!registro) {
      await t.rollback();
      return res.status(404).json({ mensajeError: 'Registro no encontrado' });
    }

    const convenioId = Number(registro.convenio_id || 0);
    const createdAt = registro.created_at; // datetime

    // monthStart calculado en MySQL para evitar corrimientos por TZ
    const [msRows] = await sequelize.query(
      `SELECT DATE_FORMAT(?, '%Y-%m-01 00:00:00') AS monthStart`,
      { replacements: [createdAt], transaction: t }
    );
    const monthStart = msRows?.[0]?.monthStart;

    // 2) Borrar la imagen
    await AdmConveniosImages.destroy({ where: { id }, transaction: t });

    // 3) Borrar la acción asociada a ESA imagen (si existe)
    // Requiere que al subir guardes: ref_tabla='adm_convenio_images', ref_id=<id imagen>
    await sequelize.query(
      `
      DELETE FROM convenios_mes_acciones
       WHERE tipo = 'SUBIR_COMPROBANTE'
         AND ref_tabla = 'adm_convenio_images'
         AND ref_id = ?
      `,
      { replacements: [id], transaction: t }
    );

    // 4) Si esta era la última imagen del mes, (opcional) reabrir la "FALTA_COMPROBANTE"
    //    para que vuelva a figurar como pendiente en acciones.
    if (monthStart && convenioId > 0) {
      const [cntRows] = await sequelize.query(
        `
        SELECT COUNT(*) AS c
          FROM adm_convenio_images
         WHERE convenio_id = ?
           AND created_at >= ?
           AND created_at < DATE_ADD(?, INTERVAL 1 MONTH)
        `,
        { replacements: [convenioId, monthStart, monthStart], transaction: t }
      );

      const restantes = Number(cntRows?.[0]?.c || 0);

      if (restantes <= 0) {
        // Asegurar que no quede ningún SUBIR_COMPROBANTE colgado del mes (por si hubo data vieja)
        await sequelize.query(
          `
          DELETE FROM convenios_mes_acciones
           WHERE convenio_id = ?
             AND monthStart = ?
             AND tipo = 'SUBIR_COMPROBANTE'
          `,
          { replacements: [convenioId, monthStart], transaction: t }
        );

        // (Opcional) Reabrir FALTA_COMPROBANTE si existía y estaba leída
        await sequelize.query(
          `
          UPDATE convenios_mes_acciones
             SET leido = 0,
                 leido_at = NULL,
                 leido_por_id = NULL,
                 leido_por_nombre = NULL,
                 updated_at = CURRENT_TIMESTAMP
           WHERE convenio_id = ?
             AND monthStart = ?
             AND tipo = 'FALTA_COMPROBANTE'
          `,
          { replacements: [convenioId, monthStart], transaction: t }
        );
      }
    }

    await t.commit();
    return res.json({ message: 'Imagen eliminada correctamente' });
  } catch (error) {
    await t.rollback();
    return res.status(500).json({ mensajeError: error.message });
  }
};

// Actualizar un registro en adm_convenio_images por su ID
export const UR_AdmConveniosImages_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const [numRowsUpdated] = await AdmConveniosImages.update(req.body, {
      where: { id }
    });

    if (numRowsUpdated === 1) {
      const registroActualizado = await AdmConveniosImages.findByPk(id);
      res.json({
        message: 'Imagen actualizada correctamente',
        registroActualizado
      });
    } else {
      res.status(404).json({ mensajeError: 'Registro no encontrado' });
    }
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};
