import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminPedidosService, Pedido, PedidosResponse } from '../../services/admin-pedidos.service';
import { GlobalService } from '../../services/global.service';
import { ReportesService } from '../../services/reportes.service';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-ventas-administrador',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ventasAdministrador.component.html',
  styleUrl: './ventasAdministrador.component.css'
})
export class VentasAdministradorComponent implements OnInit {
  pedidos: Pedido[] = [];
  cargando = true;
  error = '';
  filtroEstado: '' | 'pendiente' | 'entregado' | 'cancelado' = '';
  filtroDni = '';
  filtroFechaDesde = '';
  filtroFechaHasta = '';
  pedidoDetalle: Pedido | null = null;
  reporteProcesando = false;

  constructor(
    private adminPedidos: AdminPedidosService,
    private globalService: GlobalService,
    private reportesService: ReportesService
  ) {}

  ngOnInit(): void {
    this.globalService.checkLoggedIn('/ventasAdministrador');
    this.cargarPedidos();
  }

  cargarPedidos(): void {
    this.error = '';

    if (this.filtroFechaDesde && this.filtroFechaHasta) {
      const desde = new Date(this.filtroFechaDesde);
      const hasta = new Date(this.filtroFechaHasta);
      if (desde > hasta) {
        this.cargando = false;
        this.error = 'La fecha desde no puede ser posterior a la fecha hasta.';
        return;
      }
    }

    this.cargando = true;

    const filtros: { estado?: string; dni?: string; fechaDesde?: string; fechaHasta?: string } = {};
    if (this.filtroEstado) filtros.estado = this.filtroEstado;
    if (this.filtroDni.trim()) filtros.dni = this.filtroDni.trim();
    if (this.filtroFechaDesde) filtros.fechaDesde = this.filtroFechaDesde;
    if (this.filtroFechaHasta) filtros.fechaHasta = this.filtroFechaHasta;

    this.adminPedidos.listarPedidos(filtros).subscribe({
      next: (resp: PedidosResponse) => {
        this.pedidos = (resp.pedidos || []).sort((a, b) => {
          const da = a.creadoEl ? new Date(a.creadoEl).getTime() : 0;
          const db = b.creadoEl ? new Date(b.creadoEl).getTime() : 0;
          return db - da;
        });
        this.cargando = false;
      },
      error: (err) => {
        console.error('Error listando pedidos:', err);
        this.error = 'No se pudieron obtener los pedidos.';
        this.cargando = false;
      }
    });
  }

  limpiarFiltros(): void {
    this.filtroEstado = '';
    this.filtroDni = '';
    this.filtroFechaDesde = '';
    this.filtroFechaHasta = '';
    this.cargarPedidos();
  }

  despachar(p: Pedido): void {
    if (!confirm(`¿Marcar el pedido de ${p.dni} como despachado/entregado?`)) return;
    this.adminPedidos.despacharPedido(p._id).subscribe({
      next: (resp) => {
        if (resp.success && resp.pedido) {
          p.estado = 'entregado';
          p.fechaEntrega = new Date().toISOString();
        }
      },
      error: (err) => {
        console.error('Error al despachar pedido:', err);
        alert('No se pudo despachar el pedido.');
      }
    });
  }

  cancelar(p: Pedido): void {
    if (!confirm(`¿Cancelar el pedido de ${p.dni}? Se reembolsará el saldo al cliente.`)) return;
    this.adminPedidos.cancelarPedido(p._id).subscribe({
      next: (resp) => {
        if (resp.success && resp.pedido) {
          p.estado = 'cancelado';
        }
      },
      error: (err) => {
        console.error('Error al cancelar pedido:', err);
        alert('No se pudo cancelar el pedido.');
      }
    });
  }

  verDetalle(p: Pedido): void {
    this.pedidoDetalle = p;
  }

  cerrarDetalle(): void {
    this.pedidoDetalle = null;
  }

  generarReporteTopProductos(): void {
    const limiteInput = window.prompt('¿Cuántos productos querés incluir en el reporte?', '5');
    if (limiteInput === null) {
      return;
    }

    const limite = parseInt(limiteInput, 10);
    if (!Number.isFinite(limite) || limite <= 0) {
      alert('Ingresá un número válido de productos.');
      return;
    }

    const fechaInicio = this.solicitarFecha('Fecha de inicio (AAAA-MM-DD) - dejar vacío para todas las fechas:');
    if (fechaInicio === undefined) {
      return;
    }
    const fechaFin = this.solicitarFecha('Fecha de fin (AAAA-MM-DD) - dejar vacío para todas las fechas:');
    if (fechaFin === undefined) {
      return;
    }

    if (!this.validarRangoFechas(fechaInicio, fechaFin)) {
      return;
    }

    this.reporteProcesando = true;
    this.reportesService
      .getTopProductos(limite, fechaInicio ?? undefined, fechaFin ?? undefined)
      .subscribe({
        next: (resp) => {
          this.reporteProcesando = false;
          if (!resp.success || !resp.data || resp.data.length === 0) {
            alert('No se encontraron ventas para generar el reporte.');
            return;
          }

          const cuerpo = resp.data.map((item) => [
            item.nombre,
            item.categoria,
            this.formatNumber(item.cantidadVendida),
            this.formatCurrency(item.totalRecaudado),
            this.formatNumber(item.vendidosHistorico),
            item.stockActual ?? '-' // mantenemos signo si no hay dato
          ]);

          const titulo = `Top ${limite} productos más vendidos`;
          this.exportarPdf(
            titulo,
            ['Producto', 'Categoría', 'Cant. vendida', 'Ingresos', 'Vendidos (total)', 'Stock actual'],
            cuerpo,
            `reporte-top-productos-${Date.now()}.pdf`
          );
        },
        error: (err) => {
          console.error('Error obteniendo reporte top productos:', err);
          this.reporteProcesando = false;
          alert('Ocurrió un error al generar el reporte de productos más vendidos.');
        }
      });
  }

  generarReportePorCategoria(): void {
    const fechaInicio = this.solicitarFecha('Fecha de inicio (AAAA-MM-DD) - dejar vacío para todas las fechas:');
    if (fechaInicio === undefined) {
      return;
    }
    const fechaFin = this.solicitarFecha('Fecha de fin (AAAA-MM-DD) - dejar vacío para todas las fechas:');
    if (fechaFin === undefined) {
      return;
    }

    if (!this.validarRangoFechas(fechaInicio, fechaFin)) {
      return;
    }

    this.reporteProcesando = true;
    this.reportesService
      .getProductosPorCategoria(fechaInicio ?? undefined, fechaFin ?? undefined)
      .subscribe({
        next: (resp) => {
          this.reporteProcesando = false;
          if (!resp.success || !resp.data || resp.data.length === 0) {
            alert('No se registraron ventas por categoría en el período seleccionado.');
            return;
          }

          const cuerpo = resp.data.map((item) => [
            item.categoria,
            this.formatNumber(item.cantidadVendida),
            this.formatCurrency(item.totalRecaudado)
          ]);

          this.exportarPdf(
            'Productos vendidos por categoría',
            ['Categoría', 'Cant. vendida', 'Ingresos'],
            cuerpo,
            `reporte-por-categoria-${Date.now()}.pdf`
          );
        },
        error: (err) => {
          console.error('Error obteniendo reporte por categoría:', err);
          this.reporteProcesando = false;
          alert('Ocurrió un error al generar el reporte de ventas por categoría.');
        }
      });
  }

  generarReportePorPeriodo(): void {
    const fechaInicio = this.solicitarFecha('Fecha de inicio (AAAA-MM-DD)', true);
    if (fechaInicio === undefined) {
      return;
    }
    const fechaFin = this.solicitarFecha('Fecha de fin (AAAA-MM-DD)', true);
    if (fechaFin === undefined) {
      return;
    }

    if (!this.validarRangoFechas(fechaInicio, fechaFin, true)) {
      return;
    }

    this.reporteProcesando = true;
    this.reportesService
      .getVentasPorPeriodo(fechaInicio as string, fechaFin as string)
      .subscribe({
        next: (resp) => {
          this.reporteProcesando = false;
          if (!resp.success || !resp.data || resp.data.length === 0) {
            alert('No se encontraron ventas en el período indicado.');
            return;
          }

          const cuerpo = resp.data.map((fila) => [
            fila.fecha,
            this.formatNumber(fila.cantidadPedidos),
            this.formatNumber(fila.cantidadProductos),
            this.formatCurrency(fila.totalRecaudado)
          ]);

          const resumenLineas = resp.resumen
            ? [
                { label: 'Total de pedidos', value: this.formatNumber(resp.resumen.cantidadPedidos) },
                { label: 'Total de productos', value: this.formatNumber(resp.resumen.cantidadProductos) },
                { label: 'Total recaudado', value: this.formatCurrency(resp.resumen.totalRecaudado) }
              ]
            : undefined;

          this.exportarPdf(
            `Ventas por periodo (${fechaInicio} a ${fechaFin})`,
            ['Fecha', 'Pedidos', 'Productos', 'Ingresos'],
            cuerpo,
            `reporte-por-periodo-${Date.now()}.pdf`,
            resumenLineas
          );
        },
        error: (err) => {
          console.error('Error obteniendo reporte por periodo:', err);
          this.reporteProcesando = false;
          alert('Ocurrió un error al generar el reporte por periodo.');
        }
      });
  }

  private solicitarFecha(mensaje: string, esObligatoria = false): string | null | undefined {
    const valor = window.prompt(mensaje);
    if (valor === null) {
      return undefined;
    }

    const trimmed = valor.trim();
    if (!trimmed) {
      if (esObligatoria) {
        alert('La fecha es obligatoria.');
        return undefined;
      }
      return null;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      alert('Formato de fecha inválido. Usa AAAA-MM-DD.');
      return undefined;
    }

    return trimmed;
  }

  private validarRangoFechas(inicio: string | null, fin: string | null, obligatorio = false): boolean {
    if (!inicio && !fin) {
      return !obligatorio;
    }

    if (inicio && !fin) {
      alert('Ingresá también una fecha de fin.');
      return false;
    }

    if (!inicio && fin) {
      alert('Ingresá también una fecha de inicio.');
      return false;
    }

    if (inicio && fin) {
      const fechaInicio = new Date(inicio);
      const fechaFin = new Date(fin);
      if (fechaFin < fechaInicio) {
        alert('La fecha fin debe ser igual o posterior a la fecha de inicio.');
        return false;
      }
    }

    return true;
  }

  private exportarPdf(
    titulo: string,
    columnas: string[],
    filas: (string | number | null | undefined)[][],
    nombreArchivo: string,
    resumen?: { label: string; value: string }[]
  ): void {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(titulo, 14, 18);

    const cuerpoNormalizado = filas.map((fila) => fila.map((celda) => (celda ?? '').toString()));

    autoTable(doc, {
      head: [columnas],
      body: cuerpoNormalizado,
      startY: 26,
      styles: { fontSize: 11 },
      headStyles: { fillColor: [9, 0, 140] }
    });

    if (resumen && resumen.length) {
      const finalY = (doc as any).lastAutoTable?.finalY ?? 26;
      doc.setFontSize(12);
      resumen.forEach((linea, index) => {
        doc.text(`${linea.label}: ${linea.value}`, 14, finalY + 10 + index * 6);
      });
    }

    doc.save(nombreArchivo);
  }

  private formatCurrency(value: number): string {
    if (!Number.isFinite(value)) {
      return '$0,00';
    }
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2
    }).format(value);
  }

  private formatNumber(value: number): string {
    if (!Number.isFinite(value)) {
      return '0';
    }
    return new Intl.NumberFormat('es-AR').format(value);
  }
}
