// Controllers/CTS_TB_HxInformePdf.js
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import HxClienteModel from '../Models/MD_TB_HxClientes.js';
import HxInformeModel from '../Models/MD_TB_HxInformes.js';
import HxInformeComidaModel from '../Models/MD_TB_HxInformesComidas.js';
import { generateInformePDFBuffer } from '../utils/hx_pdf.js';
import { getInformeFilename } from '../utils/names.js';

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
    const inline = req.query.view === '1';

    // (opcional) auth aquí: if (!req.user) return res.status(401).end();

    const informe = await HxInformeModel.findByPk(id);
    if (!informe)
      return res
        .status(404)
        .json({ ok: false, message: `Informe ${id} no encontrado` });

    const cliente = await HxClienteModel.findByPk(informe.cliente_id, {
      attributes: [
        'id',
        'nombre',
        'dni',
        'sexo',
        'fecha_nacimiento',
        'altura_m'
      ]
    });

    const filename = getInformeFilename({ informe, cliente });
    const saveDir = process.env.EXPORTS_DIR || '/root/proyect/exports';
    const savePath = path.join(saveDir, filename);

    // si no existe en disco, generarlo y guardarlo
    if (!(await fileExists(savePath))) {
      const comidas = await HxInformeComidaModel.findAll({
        where: { informe_id: id },
        order: [
          ['tipo', 'ASC'],
          ['orden', 'ASC'],
          ['id', 'ASC']
        ],
        attributes: ['tipo', 'orden', 'descripcion']
      });

      const pdfBuf = await generateInformePDFBuffer({
        cliente: cliente?.toJSON() ?? {},
        informe: informe.toJSON(),
        comidas: comidas.map((r) => r.toJSON())
      });

      await fs.mkdir(saveDir, { recursive: true });
      await fs.writeFile(savePath, pdfBuf);
    }

    // headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'private, max-age=86400'); // 1 día
    res.setHeader(
      'Content-Disposition',
      inline ? 'inline' : `attachment; filename="${filename}"`
    );

    // 🚀 Preferido: Nginx interno (no expone /exports real)
    // req: configurar Nginx con location /_protected_exports/ (ver abajo)
    res.setHeader('X-Accel-Redirect', `/_protected_exports/${filename}`);
    return res.end();

    // 🔁 Fallback (si no usás X-Accel): comentar arriba y descomentar abajo
    // fss.createReadStream(savePath).pipe(res);
  } catch (err) {
    console.error('[HX] PDF serve error:', err);
    return res
      .status(500)
      .json({
        ok: false,
        code: 'PDF_ERROR',
        message: 'No se pudo generar/servir el PDF'
      });
  }
}
