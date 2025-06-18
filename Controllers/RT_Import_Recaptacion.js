import express from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
import fs from 'fs';
import Recaptacion from '../Models/MD_TB_Recaptacion.js';
import sequelize from '../DataBase/db.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });
const RecaptacionModel = Recaptacion.RecaptacionModel;

router.post(
  '/import-recaptacion/:usuario_id',
  upload.single('file'),
  async (req, res) => {
    const file = req.file;
    const { usuario_id } = req.params;

    if (!file) {
      return res
        .status(400)
        .json({ message: 'No se ha subido ningún archivo' });
    }

    try {
      // Leer archivo Excel
      const workbook = XLSX.readFile(file.path);

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        fs.unlinkSync(file.path);
        return res
          .status(400)
          .json({ message: 'El archivo no contiene hojas' });
      }

      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet, { defval: null });

      if (!Array.isArray(data) || data.length === 0) {
        fs.unlinkSync(file.path);
        return res
          .status(400)
          .json({ message: 'El archivo está vacío o no tiene datos' });
      }

      // Validar que existan las columnas esperadas
      const firstRow = data[0];
      const requiredColumns = ['Nombre', 'Tipo de contacto'];

      const missingColumns = requiredColumns.filter(
        (col) => !(col in firstRow)
      );

      if (missingColumns.length > 0) {
        fs.unlinkSync(file.path);
        return res.status(400).json({
          message: `Faltan columnas obligatorias: ${missingColumns.join(', ')}`
        });
      }

      // Filtrar filas que tengan los datos obligatorios
      const validData = data.filter(
        (row) => row.Nombre && row['Tipo de contacto']
      );

      if (validData.length === 0) {
        fs.unlinkSync(file.path);
        return res
          .status(400)
          .json({ message: 'No se encontraron filas con datos válidos' });
      }

      const transaction = await sequelize.transaction();
      try {
        for (const row of validData) {
          await RecaptacionModel.create(
            {
              usuario_id: usuario_id,
              nombre: row.Nombre,
              tipo_contacto: row['Tipo de contacto'],
              detalle_contacto: row['Detalle contacto'] || null,
              enviado: false,
              respondido: false,
              agendado: false,
              convertido: false
            },
            { transaction }
          );
        }
        await transaction.commit();
        fs.unlinkSync(file.path);
        res.status(200).json({ message: 'Importación exitosa' });
      } catch (error) {
        await transaction.rollback();
        fs.unlinkSync(file.path);
        console.error('Error al insertar datos:', error);
        console.error('Fila con error:', row); // <== Esto imprimirá el último row fallido
        res.status(500).json({
          message: 'Error al insertar los datos',
          error: error.message
        });
      }
    } catch (error) {
      if (file) fs.unlinkSync(file.path);
      console.error('Error procesando archivo:', error);
      return res.status(500).json({
        message:
          'Error al procesar el archivo. ¿Está en formato Excel válido (.xls/.xlsx)?',
        error: error.message
      });
    }
  }
);

export default router;
