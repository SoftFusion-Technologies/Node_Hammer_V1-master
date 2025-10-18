// Controllers/CTS_TB_HxPDF.controller.js
import fs from 'node:fs/promises';
import path from 'node:path';

import HxClienteModel from '../Models/MD_TB_HxClientes.js';
import HxInformeModel from '../Models/MD_TB_HxInformes.js';
import HxInformeComidaModel from '../Models/MD_TB_HxInformesComidas.js';
import { generateInformePDFBuffer } from '../utils/hx_pdf.js';

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function GET_InformePDF(req, res) {
  try {
    const { id } = req.params;

    // 1) Buscar informe + cliente + comidas
    const informe = await HxInformeModel.findByPk(id, {
      include: [
        {
          model: HxClienteModel,
          as: 'cliente',
          attributes: ['id', 'nombre', 'dni', 'sexo', 'fecha_nacimiento', 'altura_m']
        },
        {
          model: HxInformeComidaModel,
          as: 'comidas',
          attributes: ['tipo', 'orden', 'descripcion']
        }
      ],
      order: [
        [{ model: HxInformeComidaModel, as: 'comidas' }, 'tipo', 'ASC'],
        [{ model: HxInformeComidaModel, as: 'comidas' }, 'orden', 'ASC']
      ]
    });

    if (!informe) {
      return res
        .status(404)
        .json({ ok: false, message: `Informe ${id} no encontrado` });
    }

    const fecha = informe.fecha || new Date().toISOString().slice(0, 10);
    const filename = `informe-${fecha}-${informe.id}.pdf`;
    const saveDir = path.resolve('./exports');
    const savePath = path.join(saveDir, filename);

    // 2) Si ya existe en disco, enviarlo directo
    if (await fileExists(savePath)) {
      const data = await fs.readFile(savePath);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`
      );
      return res.end(data);
    }

    // 3) Si no existe, generarlo, guardar y enviar
    const pdfBuffer = await generateInformePDFBuffer({
      cliente: informe.cliente?.toJSON() ?? {},
      informe: informe.toJSON(),
      comidas: (informe.comidas ?? []).map((c) => c.toJSON())
    });

    await fs.mkdir(saveDir, { recursive: true });
    await fs.writeFile(savePath, pdfBuffer);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.end(pdfBuffer);
  } catch (err) {
    return res.status(500).json({
      ok: false,
      code: 'PDF_ERROR',
      message: 'No se pudo generar/descargar el PDF',
      detail: process.env.NODE_ENV === 'production' ? undefined : err.message
    });
  }
}
