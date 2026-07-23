import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';

@Injectable()
export class ReportesService {
  constructor(private readonly dataSource: DataSource) {}

  async exportarSocioeconomicoExcel(res: Response, periodoId: string) {
    const periodo = await this.dataSource.manager.query(
      `SELECT nombre FROM periodos_matricula WHERE id = $1 AND fecha_desactivacion IS NULL`,
      [periodoId],
    );

    if (!periodo || periodo.length === 0) {
      throw new NotFoundException('El periodo de matrícula solicitado no existe o está inactivo.');
    }

    const nombrePeriodo = periodo[0].nombre;

    const estudiantesFichas = await this.dataSource.manager
      .createQueryBuilder()
      .select([
        'u.cedula AS cedula',
        "CONCAT(u.primer_apellido, ' ', COALESCE(u.segundo_apellido, '')) AS apellidos",
        "CONCAT(u.primer_nombre, ' ', COALESCE(u.segundo_nombre, '')) AS nombres",
        'u.email_institucional AS email',
        'c.nombre AS carrera',
        'f.estado_ficha AS estado',
        'f.total_ingresos AS ingresos',
        'f.total_egresos AS egresos',
        'f.balance_final AS balance',
        'n.nombre AS nivel_economico',
      ])
      .from('fichas_respondidas', 'f')
      .innerJoin('usuarios', 'u', 'u.id = f.usuario_id')
      .leftJoin('carreras', 'c', 'c.id = u.carrera_id')
      .leftJoin('niveles_economicos', 'n', 'n.id = f.nivel_economico_id')
      .where('f.periodo_id = :periodoId', { periodoId })
      .andWhere('f.fecha_desactivacion IS NULL')
      .orderBy('c.nombre', 'ASC')
      .addOrderBy('u.primer_apellido', 'ASC')
      .getRawMany();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Reporte Socioeconómico');

    worksheet.columns = [
      { header: 'CÉDULA', key: 'cedula', width: 15 },
      { header: 'APELLIDOS', key: 'apellidos', width: 25 },
      { header: 'NOMBRES', key: 'nombres', width: 25 },
      { header: 'EMAIL', key: 'email', width: 30 },
      { header: 'CARRERA', key: 'carrera', width: 35 },
      { header: 'ESTADO FICHA', key: 'estado', width: 15 },
      { header: 'TOTAL INGRESOS', key: 'ingresos', width: 18 },
      { header: 'TOTAL EGRESOS', key: 'egresos', width: 18 },
      { header: 'BALANCE FINAL', key: 'balance', width: 18 },
      { header: 'NIVEL SOCIOECONÓMICO', key: 'nivel_economico', width: 25 },
    ];

    worksheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1B365D' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    estudiantesFichas.forEach((est) => {
      // 👈 Corrección de Tipado: Resguardo contra nulos / NaN antes de convertir a Float
      const row = worksheet.addRow({
        cedula: est.cedula,
        apellidos: est.apellidos?.toUpperCase(),
        nombres: est.nombres?.toUpperCase(),
        email: est.email,
        carrera: est.carrera,
        estado: est.estado,
        ingresos: est.ingresos ? parseFloat(est.ingresos.toString()) : 0,
        egresos: est.egresos ? parseFloat(est.egresos.toString()) : 0,
        balance: est.balance ? parseFloat(est.balance.toString()) : 0,
        nivel_economico: est.nivel_economico ?? 'SIN CLASIFICAR',
      });

      row.getCell('ingresos').numFmt = '"$"#,##0.00';
      row.getCell('egresos').numFmt = '"$"#,##0.00';
      row.getCell('balance').numFmt = '"$"#,##0.00';
    });

    const nombreLimpioPeriodo = nombrePeriodo.replace(/[^a-zA-Z0-9]/g, '_');
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=Reporte_Socioeconomico_${nombreLimpioPeriodo}.xlsx`,
    );

    await workbook.xlsx.write(res);
    res.end();
  }
}