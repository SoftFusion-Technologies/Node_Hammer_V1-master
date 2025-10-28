// Controllers/CTS_TB_HxController.js
import { Op } from 'sequelize';
import HxImagenBalanzaModel from '../Models/MD_TB_HxImagenesBalanza.js';
import HxInformeModel from '../Models/MD_TB_HxInformes.js';
import HxClienteModel from '../Models/MD_TB_HxClientes.js';

function apiBaseFromReq(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}`;
}

export async function GET_InformeByBatch(req, res) {
  try {
    // ✅ aceptar múltiples variantes y trim
    const raw =
      req.params?.batchId ??
      req.params?.batch_id ??
      req.query?.batchId ??
      req.query?.batch_id ??
      '';
    const batchId = String(raw).trim();

    // ✅ validación más clara (UUID-like o al menos 16 chars alfanum+guiones)
    const looksUUID = /^[a-f0-9-]{16,}$/i.test(batchId);
    if (!batchId || batchId.length < 8 || !looksUUID) {
      return res.status(400).json({
        ok: false,
        code: 'BAD_BATCH',
        message: 'batch_id inválido',
        detail: { received: raw }
      });
    }

    // Buscar imagen del batch ya vinculada a un informe
    const img = await HxImagenBalanzaModel.findOne({
      where: { batch_id: batchId, informe_id: { [Op.ne]: null } },
      order: [['created_at', 'DESC']]
    });

    if (!img?.informe_id) {
      return res.status(404).json({
        ok: false,
        code: 'INFORME_PENDING',
        message: 'El informe aún no está disponible para este batch.'
      });
    }

    const informe = await HxInformeModel.findByPk(img.informe_id, {
      include: [
        {
          model: HxClienteModel,
          as: 'cliente',
          attributes: ['id', 'nombre', 'dni']
        }
      ]
    });
    if (!informe) {
      return res.status(404).json({
        ok: false,
        code: 'INFORME_NOT_FOUND',
        message: `No existe informe ${img.informe_id} para el batch.`
      });
    }

    const apiBase = apiBaseFromReq(req);
    const pdfUrl = `/hx/informes/${informe.id}/pdf`;
    const inline = `/hx/informes/${informe.id}/pdf?view=1`;

    return res.json({
      ok: true,
      informe_id: informe.id,
      cliente_id: informe.cliente_id,
      pdf: {
        generated: false,
        url: pdfUrl,
        absolute_url: apiBase + pdfUrl,
        inline_url: inline,
        inline_absolute_url: apiBase + inline
      }
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      code: 'BY_BATCH_ERROR',
      message: 'Error al resolver informe por batch_id',
      detail: process.env.NODE_ENV === 'production' ? undefined : err.message
    });
  }
}
