import express from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
import IntegranteConveImp from '../Models/MD_TB_IntegrantesConveImp.js';
import { validateData } from '../utils/validators.js';
import sequelize from '../DataBase/db.js';
import fs from 'fs'; // Asegúrate de importar fs para eliminar el archivo

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.post('/import/:id_conv', upload.single('file'), async (req, res) => {
  const file = req.file;
  const { id_conv } = req.params;

  if (!file) {
    return res.status(400).json({ message: 'No se ha subido ningún archivo' });
  }

  if (!id_conv) {
    return res
      .status(400)
      .json({ message: 'El parámetro id_conv es requerido' });
  }

  try {
    // Leer el archivo y convertirlo en JSON
    const workbook = XLSX.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    // Validar datos
    const validData = validateData(sheet);

    if (validData.length === 0) {
      // Asegúrate de que solo se envíe una respuesta
      fs.unlinkSync(file.path);
      return res
        .status(400)
        .json({ message: 'No se encontraron datos válidos para importar' });
    }

    // Iniciar transacción
    const transaction = await sequelize.transaction();

    try {
      // Insertar los datos en la tabla `integrantes_conve`
      for (const integrante of validData) {
        await IntegranteConveImp.create(
          {
            id_conv, // Usar el id_conv de la URL
            nombre: integrante.nombre,
            telefono: integrante.telefono,
            dni: integrante.dni,
            email: integrante.email,
            notas: integrante.notas,
            precio: integrante.precio,
            descuento: integrante.descuento,
            preciofinal: integrante.preciofinal,
            userName: integrante.userName,
            fechaCreacion: integrante.fechaCreacion || new Date()
          },
          { transaction }
        );
      }

      // Confirmar la transacción si todo va bien
      await transaction.commit();
      fs.unlinkSync(file.path); // Eliminar el archivo cargado
      res.status(200).json({ message: 'Importación exitosa' });
    } catch (error) {
      // Si algo falla, revertir la transacción
      await transaction.rollback();
      fs.unlinkSync(file.path); // Eliminar el archivo cargado
      if (!res.headersSent) {
        res
          .status(500)
          .json({
            message: 'Error al insertar los datos',
            error: error.message
          });
      }
    }
  } catch (error) {
    if (!res.headersSent) {
      res
        .status(500)
        .json({ message: 'Error en la importación', error: error.message });
    }
  }
});

export default router;
