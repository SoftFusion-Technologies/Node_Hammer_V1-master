/*
 * Programador: Benjamin Orellana
 * Fecha Cración: 22-10-2024
 * Versión: 0.1
 *
 * Descripción:
 * Este archivo (CTS_TB_Alumnos.js) contiene controladores para manejar operaciones CRUD en el modelo de alumnos.
 *
 * Tema: Controladores - Alumnos
 *
 * Capa: Backend
 *
 * Nomenclatura: OBR_ obtenerRegistro
 *               OBRS_obtenerRegistros(plural)
 *               CR_ crearRegistro
 *               ER_ eliminarRegistro
 */

// Importa los modelos necesarios desde el archivo de modelos
import MD_TB_Alumnos from '../Models/MD_TB_Alumnos.js';
import db from '../DataBase/db.js'; // Importa la conexión a la base de datos

// Asigna los modelos a variables para su uso en los controladores
const AlumnosModel = MD_TB_Alumnos.AlumnosModel;

// Controladores para operaciones CRUD en la tabla 'alumnos'

// Mostrar todos los registros de la tabla alumnos con filtro opcional por mes y año
export const OBRS_Alumnos_CTS = async (req, res) => {
  try {
    const { mes, anio } = req.query;

    const filtros = {};
    if (mes) filtros.mes = mes;
    if (anio) filtros.anio = anio;

    // Buscar los registros de alumnos con los filtros aplicados
    const registros = await AlumnosModel.findAll({
      where: filtros
    });

    res.json(registros);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};


// Mostrar un registro específico de Alumnos por su ID
export const OBR_Alumnos_CTS = async (req, res) => {
  try {
    const registro = await AlumnosModel.findByPk(req.params.id);
    res.json(registro);
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

export const CR_Alumnos_CTS = async (req, res) => {
  try {
    const { prospecto, ...resto } = req.body; // Desestructuramos el `prospecto` y el resto de los datos

    console.log('Datos recibidos:', req.body); // Verifica los datos recibidos
    console.log('Prospecto:', prospecto); // Verifica el valor de prospecto

    // Crear registro en la tabla 'alumnos'
    const alumnoCreado = await AlumnosModel.create(req.body);
    console.log('Alumno creado en alumnos:', alumnoCreado); // Verifica el alumno creado

    // Obtener mes y año actuales
    const currentDate = new Date();
    const mesActual = currentDate.getMonth() + 1; // getMonth() devuelve 0-11, sumamos 1 para obtener el rango 1-12
    const anioActual = currentDate.getFullYear();

    // Si el alumno es de tipo 'prospecto', insertamos en la tabla 'alumnos_prospecto'
    if (prospecto === 'prospecto') {
      console.log('Alumno es prospecto, insertando en alumnos_prospecto');

      // Crear el mismo registro en la tabla 'alumnos_prospecto' con los valores de mes y anio actuales
      await db.query(
        'INSERT INTO alumnos_prospecto (nombre, prospecto, c, email, celular, punto_d, motivo, user_id, fecha_creacion, mes, anio) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        {
          replacements: [
            alumnoCreado.nombre,
            alumnoCreado.prospecto,
            alumnoCreado.c,
            alumnoCreado.email,
            alumnoCreado.celular,
            alumnoCreado.punto_d,
            alumnoCreado.motivo,
            alumnoCreado.user_id,
            alumnoCreado.fecha_creacion,
            mesActual, // Pasar el mes actual
            anioActual // Pasar el año actual
          ]
        }
      );
      console.log('Alumno insertado en alumnos_prospecto');
    } else {
      console.log('Alumno no es prospecto, no se insertó en alumnos_prospecto');
    }

    res.json({ message: 'Registro creado correctamente' });
  } catch (error) {
    console.error('Error al crear el alumno:', error); // Log del error
    res.json({ mensajeError: error.message });
  }
};


// Eliminar un registro en Alumnos por su ID
export const ER_Alumnos_CTS = async (req, res) => {
  try {
    await AlumnosModel.destroy({ where: { id: req.params.id } });
    res.json({ message: 'Registro eliminado correctamente' });
  } catch (error) {
    res.json({ mensajeError: error.message });
  }
};

// Actualizar un registro en Alumnos por su ID
export const UR_Alumnos_CTS = async (req, res) => {
  try {
    const { id } = req.params;
    const [numRowsUpdated] = await AlumnosModel.update(req.body, {
      where: { id }
    });

    if (numRowsUpdated === 1) {
      const registroActualizado = await AlumnosModel.findByPk(id);
      res.json({
        message: 'Registro actualizado correctamente',
        registroActualizado
      });
    } else {
      res.status(404).json({ mensajeError: 'Registro no encontrado' });
    }
  } catch (error) {
    res.status(500).json({ mensajeError: error.message });
  }
};
