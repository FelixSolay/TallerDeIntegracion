import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminPedidosService, Pedido, PedidosResponse } from '../../services/admin-pedidos.service';
import { GlobalService } from '../../services/global.service';
import { ReportesService } from '../../services/reportes.service';
import { ConfirmPopupComponent } from '../confirmPopup/confirmPopup.component';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

type ReportPanel = 'top' | 'categoria' | 'periodo' | null;

@Component({
  selector: 'app-ventas-administrador',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmPopupComponent],
  templateUrl: './ventasAdministrador.component.html',
  styleUrl: './ventasAdministrador.component.css'
})
export class VentasAdministradorComponent implements OnInit {
  pedidos: Pedido[] = [];
  cargando = true;
  error = '';
  filtroEstado: '' | 'pendiente' | 'entregado' | 'cancelado' = '';
  filtroPedidoId = '';
  filtroDni = '';
  filtroFechaDesde = '';
  filtroFechaHasta = '';
  pedidoDetalle: Pedido | null = null;
  
  // Popup de confirmación
  mostrarConfirmacion = false;
  confirmacionTitulo = '';
  confirmacionMensaje = '';
  confirmacionAccion: (() => void) | null = null;
  reporteProcesando = false;
  panelActivo: ReportPanel = null;
  topForm = {
    limite: 5,
    fechaDesde: '',
    fechaHasta: ''
  };
  categoriaForm = {
    fechaDesde: '',
    fechaHasta: ''
  };
  periodoForm = {
    fechaDesde: '',
    fechaHasta: ''
  };
  reporteMensaje = '';
  reporteMensajeTipo: 'info' | 'error' | 'success' | '' = '';
  panelMensaje: ReportPanel = null;

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
        let pedidosFiltrados = resp.pedidos || [];
        
        // Filtrar por número de pedido si existe
        if (this.filtroPedidoId.trim()) {
          const idBusqueda = this.filtroPedidoId.trim().toLowerCase();
          pedidosFiltrados = pedidosFiltrados.filter(p => 
            p._id.toLowerCase().includes(idBusqueda)
          );
        }
        
        this.pedidos = pedidosFiltrados.sort((a, b) => {
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
    this.filtroPedidoId = '';
    this.filtroDni = '';
    this.filtroFechaDesde = '';
    this.filtroFechaHasta = '';
    this.cargarPedidos();
  }

  despachar(p: Pedido): void {
    this.confirmacionTitulo = 'Confirmar despacho';
    this.confirmacionMensaje = `¿Marcar el pedido de ${p.dni} como despachado/entregado?`;
    this.confirmacionAccion = () => {
      this.adminPedidos.despacharPedido(p._id).subscribe({
        next: (resp) => {
          if (resp.success && resp.pedido) {
            p.estado = 'entregado';
            p.fechaEntrega = new Date().toISOString();
          }
          this.cerrarConfirmacion();
        },
        error: (err) => {
          console.error('Error al despachar pedido:', err);
          alert('No se pudo despachar el pedido.');
          this.cerrarConfirmacion();
        }
      });
    };
    this.mostrarConfirmacion = true;
  }

  cancelar(p: Pedido): void {
    this.confirmacionTitulo = 'Confirmar cancelación';
    this.confirmacionMensaje = `¿Cancelar el pedido de ${p.dni}? Se reembolsará el saldo al cliente.`;
    this.confirmacionAccion = () => {
      this.adminPedidos.cancelarPedido(p._id).subscribe({
        next: (resp) => {
          if (resp.success && resp.pedido) {
            p.estado = 'cancelado';
          }
          this.cerrarConfirmacion();
        },
        error: (err) => {
          console.error('Error al cancelar pedido:', err);
          alert('No se pudo cancelar el pedido.');
          this.cerrarConfirmacion();
        }
      });
    };
    this.mostrarConfirmacion = true;
  }

  confirmarAccion(): void {
    if (this.confirmacionAccion) {
      this.confirmacionAccion();
    }
  }

  cerrarConfirmacion(): void {
    this.mostrarConfirmacion = false;
    this.confirmacionTitulo = '';
    this.confirmacionMensaje = '';
    this.confirmacionAccion = null;
  }

  verDetalle(p: Pedido): void {
    this.pedidoDetalle = p;
  }

  cerrarDetalle(): void {
    this.pedidoDetalle = null;
  }

  generarReporteTopProductos(): void {
    this.resetMensaje();

    const limite = Number(this.topForm.limite);
    if (!Number.isFinite(limite) || limite <= 0) {
      this.mostrarMensaje('error', 'Ingresá una cantidad válida de productos.', 'top');
      return;
    }

    const fechaInicio = this.normalizarFecha(this.topForm.fechaDesde);
    const fechaFin = this.normalizarFecha(this.topForm.fechaHasta);

    if (this.topForm.fechaDesde && !fechaInicio) {
      this.mostrarMensaje('error', 'La fecha desde debe tener formato dd/mm/aaaa.', 'top');
      return;
    }

    if (this.topForm.fechaHasta && !fechaFin) {
      this.mostrarMensaje('error', 'La fecha hasta debe tener formato dd/mm/aaaa.', 'top');
      return;
    }

    if (!this.validarRangoFechas(fechaInicio, fechaFin, false, 'top')) {
      return;
    }

    this.reporteProcesando = true;
    this.reportesService
      .getTopProductos(limite, fechaInicio ?? undefined, fechaFin ?? undefined)
      .subscribe({
        next: (resp) => {
          this.reporteProcesando = false;
          if (!resp.success || !resp.data || resp.data.length === 0) {
            this.mostrarMensaje('info', 'No se encontraron ventas para generar el reporte.', 'top');
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
            ['Producto', 'Categoría', 'Cant. vendida', 'Ingresos', 'Vendidos histórico', 'Stock actual'],
            cuerpo,
            `reporte-top-productos-${Date.now()}.pdf`
          );
          this.mostrarMensaje('success', 'Reporte de productos generado con éxito.', 'top');
        },
        error: (err) => {
          console.error('Error obteniendo reporte top productos:', err);
          this.reporteProcesando = false;
          this.mostrarMensaje('error', 'Ocurrió un error al generar el reporte de productos más vendidos.', 'top');
        }
      });
  }

  generarReportePorCategoria(): void {
    this.resetMensaje();

    const fechaInicio = this.normalizarFecha(this.categoriaForm.fechaDesde);
    const fechaFin = this.normalizarFecha(this.categoriaForm.fechaHasta);

    if (this.categoriaForm.fechaDesde && !fechaInicio) {
      this.mostrarMensaje('error', 'La fecha desde debe tener formato dd/mm/aaaa.', 'categoria');
      return;
    }

    if (this.categoriaForm.fechaHasta && !fechaFin) {
      this.mostrarMensaje('error', 'La fecha hasta debe tener formato dd/mm/aaaa.', 'categoria');
      return;
    }

    if (!this.validarRangoFechas(fechaInicio, fechaFin, false, 'categoria')) {
      return;
    }

    this.reporteProcesando = true;
    this.reportesService
      .getProductosPorCategoria(fechaInicio ?? undefined, fechaFin ?? undefined)
      .subscribe({
        next: (resp) => {
          this.reporteProcesando = false;
          if (!resp.success || !resp.data || resp.data.length === 0) {
            this.mostrarMensaje('info', 'No se registraron ventas por categoría en el período seleccionado.', 'categoria');
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
          this.mostrarMensaje('success', 'Reporte por categoría generado con éxito.', 'categoria');
        },
        error: (err) => {
          console.error('Error obteniendo reporte por categoría:', err);
          this.reporteProcesando = false;
          this.mostrarMensaje('error', 'Ocurrió un error al generar el reporte de ventas por categoría.', 'categoria');
        }
      });
  }

  generarReportePorPeriodo(): void {
    this.resetMensaje();

    const fechaInicio = this.normalizarFecha(this.periodoForm.fechaDesde);
    const fechaFin = this.normalizarFecha(this.periodoForm.fechaHasta);

    if (!this.periodoForm.fechaDesde) {
      this.mostrarMensaje('error', 'Seleccioná la fecha de inicio.', 'periodo');
      return;
    }

    if (!this.periodoForm.fechaHasta) {
      this.mostrarMensaje('error', 'Seleccioná la fecha de fin.', 'periodo');
      return;
    }

    if (!fechaInicio || !fechaFin) {
      this.mostrarMensaje('error', 'Usá el formato dd/mm/aaaa o el calendario para elegir las fechas.', 'periodo');
      return;
    }

    if (!this.validarRangoFechas(fechaInicio, fechaFin, true, 'periodo')) {
      return;
    }

    this.reporteProcesando = true;
    this.reportesService
      .getVentasPorPeriodo(fechaInicio as string, fechaFin as string)
      .subscribe({
        next: (resp) => {
          this.reporteProcesando = false;
          if (!resp.success || !resp.data || resp.data.length === 0) {
            this.mostrarMensaje('info', 'No se encontraron ventas en el período indicado.', 'periodo');
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
          this.mostrarMensaje('success', 'Reporte por periodo generado con éxito.', 'periodo');
        },
        error: (err) => {
          console.error('Error obteniendo reporte por periodo:', err);
          this.reporteProcesando = false;
          this.mostrarMensaje('error', 'Ocurrió un error al generar el reporte por periodo.', 'periodo');
        }
      });
  }
  togglePanel(panel: ReportPanel): void {
    this.panelActivo = this.panelActivo === panel ? null : panel;
    this.resetMensaje();
  }

  private validarRangoFechas(
    inicio: string | null,
    fin: string | null,
    obligatorio = false,
    panel?: ReportPanel
  ): boolean {
    if (!inicio && !fin) {
      if (obligatorio) {
        this.mostrarMensaje('error', 'Necesitás seleccionar ambas fechas.', panel);
      }
      return !obligatorio;
    }

    if (inicio && !fin) {
      this.mostrarMensaje('error', 'Ingresá también una fecha de fin.', panel);
      return false;
    }

    if (!inicio && fin) {
      this.mostrarMensaje('error', 'Ingresá también una fecha de inicio.', panel);
      return false;
    }

    if (inicio && fin) {
      const fechaInicio = new Date(inicio);
      const fechaFin = new Date(fin);
      if (fechaFin < fechaInicio) {
        this.mostrarMensaje('error', 'La fecha fin debe ser igual o posterior a la fecha de inicio.', panel);
        return false;
      }
    }

    return true;
  }

  private normalizarFecha(valor: string): string | null {
    if (!valor) {
      return null;
    }

    const limpio = valor.trim();
    if (!limpio) {
      return null;
    }

    if (/^[\d]{4}-[\d]{2}-[\d]{2}$/.test(limpio)) {
      return limpio;
    }

    if (/^[\d]{2}\/[\d]{2}\/[\d]{4}$/.test(limpio)) {
      const [dia, mes, anio] = limpio.split('/');
      return `${anio}-${mes}-${dia}`;
    }

    return null;
  }

  private mostrarMensaje(tipo: 'info' | 'error' | 'success', mensaje: string, panel: ReportPanel | null = null): void {
    this.reporteMensaje = mensaje;
    this.reporteMensajeTipo = tipo;
    this.panelMensaje = panel;
  }

  resetMensaje(): void {
    this.reporteMensaje = '';
    this.reporteMensajeTipo = '';
    this.panelMensaje = null;
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
