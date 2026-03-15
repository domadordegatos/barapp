import { Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { AdminService } from '../../services/admin.service';
import { NotificationService } from '../../services/notification.service';
import { firstValueFrom } from 'rxjs';
import { RockolaService } from '../../services/rockola.service';
import { Subscription } from 'rxjs';

interface FacturaItemView {
  idProd: string;
  nombre: string;
  precioUnit: number;
  cantidad: number;
  subtotal: number;
}

interface FacturaPedidoView {
  idPedido: string;
  estado: string;
  horaSolicitud: string;
  fechaSolicitud: string;
  items: FacturaItemView[];
}

interface FacturaHistorialView {
  id: string;
  numeroMesa: number;
  total: number;
  fechaApertura: Date | null;
  fechaCierre: Date;
  observaciones: string;
  pedidos: FacturaPedidoView[];
  seleccionada: boolean;
}

interface ConfiguracionFacturaBar {
  nombreBarVisible: string;
  logoFactura: string;
  nitFactura: string;
  telefonoFactura: string;
  direccionFactura: string;
  mensajeFactura: string;
  anchoFacturaCm: number;
}

@Component({
  selector: 'app-historial-facturas',
  templateUrl: './historial-facturas.component.html',
  styleUrls: ['./historial-facturas.component.scss']
})
export class HistorialFacturasComponent implements OnChanges, OnDestroy {
  @Input() nombreBar: string = '';
  @Input() nombreBarReal: string = '';
  @Input() esAdmin: boolean = false;

  fechaInicio: string = '';
  fechaFin: string = '';
  cargandoHistorial: boolean = false;
  guardandoEdicion: boolean = false;
  historialFacturas: FacturaHistorialView[] = [];
  facturaDetalle: FacturaHistorialView | null = null;
  mostrandoModalEdicion: boolean = false;
  facturaEditando: FacturaHistorialView | null = null;
  configuracionFactura: ConfiguracionFacturaBar = this.crearConfiguracionFactura();

  private barSubscription: Subscription | null = null;

  constructor(
    private adminService: AdminService,
    private notificationService: NotificationService,
    private rockolaService: RockolaService
  ) {
    this.fechaFin = this.formatearFechaInput(new Date());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['nombreBar'] && this.nombreBar) {
      this.escucharConfiguracionFactura();
    }
  }

  ngOnDestroy(): void {
    if (this.barSubscription) {
      this.barSubscription.unsubscribe();
    }
  }

  get totalFacturasSeleccionadas(): number {
    return this.historialFacturas.filter((factura) => factura.seleccionada).length;
  }

  get totalVentasSeleccionadas(): number {
    return this.historialFacturas
      .filter((factura) => factura.seleccionada)
      .reduce((total, factura) => total + Number(factura.total || 0), 0);
  }

  get seleccionTotalActiva(): boolean {
    return this.historialFacturas.length > 0 && this.historialFacturas.every((factura) => factura.seleccionada);
  }

  turnoIcono(fecha: Date | null): string {
    if (!fecha) return '🌅';
    const h = fecha.getHours();
    return h >= 6 && h < 18 ? '☀️' : '🌙';
  }

  esCierreNocturno(fecha: Date): boolean {
    const h = fecha.getHours();
    return h >= 18 || h < 6;
  }

  async buscarHistorialPorRango() {
    if (!this.nombreBar) {
      this.notificationService.warning('No se pudo identificar el bar para consultar facturas.');
      return;
    }

    if (!this.fechaInicio) {
      this.notificationService.warning('Selecciona una fecha inicial.');
      return;
    }

    if (!this.fechaFin) {
      this.fechaFin = this.formatearFechaInput(new Date());
    }

    const inicio = this.construirInicioDia(this.fechaInicio);
    const fin = this.construirFinDia(this.fechaFin);

    if (inicio.getTime() > fin.getTime()) {
      this.notificationService.warning('La fecha inicial no puede ser mayor que la fecha final.');
      return;
    }

    this.cargandoHistorial = true;

    try {
      const facturas = await firstValueFrom(
        this.adminService.obtenerFacturasFinalizadasPorRango(this.nombreBar, inicio, fin)
      ) as any[];

      this.historialFacturas = (facturas || [])
        .map((factura) => ({
          id: String(factura?.id || ''),
          numeroMesa: Number(factura?.numeroMesa || 0),
          total: Number(factura?.total || 0),
          fechaApertura: this.normalizarFechaFirestoreOpcional(factura?.fechaApertura),
          fechaCierre: this.normalizarFechaFirestore(factura?.fechaCierre || factura?.fechaArchivo),
          observaciones: String(factura?.observaciones || '').trim(),
          pedidos: this.normalizarPedidos(factura?.pedidos),
          seleccionada: true
        }))
        .filter((factura) => {
          const tiempo = factura.fechaCierre.getTime();
          return tiempo >= inicio.getTime() && tiempo <= fin.getTime();
        })
        .map((factura) => ({
          ...factura,
          total: this.calcularTotalFactura(factura)
        }))
        .sort((facturaA, facturaB) => facturaB.fechaCierre.getTime() - facturaA.fechaCierre.getTime());

      if (this.historialFacturas.length === 0) {
        this.notificationService.info('No se encontraron facturas cerradas en ese rango.');
      }
    } catch (error) {
      console.error(error);
      this.notificationService.error('No se pudo consultar el historial de facturas.');
    } finally {
      this.cargandoHistorial = false;
    }
  }

  alternarSeleccionTodas(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.historialFacturas = this.historialFacturas.map((factura) => ({
      ...factura,
      seleccionada: checked
    }));
  }

  abrirDetalleFactura(factura: FacturaHistorialView, event?: Event) {
    event?.stopPropagation();
    this.facturaDetalle = this.clonarFactura(factura);
  }

  cerrarDetalleFactura() {
    this.facturaDetalle = null;
  }

  abrirEdicionFactura() {
    if (!this.esAdmin || !this.facturaDetalle) {
      return;
    }

    this.facturaEditando = this.clonarFactura(this.facturaDetalle);
    this.mostrandoModalEdicion = true;
  }

  cerrarModalEdicionFactura() {
    if (this.guardandoEdicion) {
      return;
    }

    this.mostrandoModalEdicion = false;
    this.facturaEditando = null;
  }

  cambiarCantidadItemFactura(indexPedido: number, indexItem: number, delta: number) {
    if (!this.facturaEditando) {
      return;
    }

    const pedido = this.facturaEditando.pedidos[indexPedido];
    const item = pedido?.items[indexItem];

    if (!item) {
      return;
    }

    item.cantidad += delta;

    if (item.cantidad <= 0) {
      pedido.items.splice(indexItem, 1);
    }

    if (pedido.items.length === 0) {
      this.facturaEditando.pedidos.splice(indexPedido, 1);
    }

    this.recalcularFacturaEditando();
  }

  eliminarItemFactura(indexPedido: number, indexItem: number) {
    if (!this.facturaEditando?.pedidos[indexPedido]?.items[indexItem]) {
      return;
    }

    this.facturaEditando.pedidos[indexPedido].items.splice(indexItem, 1);

    if (this.facturaEditando.pedidos[indexPedido].items.length === 0) {
      this.facturaEditando.pedidos.splice(indexPedido, 1);
    }

    this.recalcularFacturaEditando();
  }

  async guardarEdicionFactura() {
    if (!this.esAdmin) {
      this.notificationService.warning('Solo un admin puede editar facturas finalizadas.');
      return;
    }

    if (!this.facturaEditando || this.guardandoEdicion) {
      return;
    }

    this.guardandoEdicion = true;

    try {
      this.recalcularFacturaEditando();
      const payload = {
        pedidos: this.facturaEditando.pedidos,
        total: this.facturaEditando.total,
        observaciones: this.facturaEditando.observaciones || '',
        ultimaEdicion: new Date()
      };

      await this.adminService.actualizarFacturaFinalizada(this.facturaEditando.id, payload);

      this.historialFacturas = this.historialFacturas.map((factura) => {
        if (factura.id !== this.facturaEditando?.id) {
          return factura;
        }

        return {
          ...this.clonarFactura(this.facturaEditando),
          seleccionada: factura.seleccionada
        };
      });

      this.facturaDetalle = this.clonarFactura(this.facturaEditando);
      this.notificationService.success('Factura actualizada correctamente.');
      this.cerrarModalEdicionFactura();
    } catch (error) {
      console.error(error);
      this.notificationService.error('No se pudo actualizar la factura.');
    } finally {
      this.guardandoEdicion = false;
    }
  }

  imprimirFacturaDetalle() {
    if (!this.facturaDetalle) {
      return;
    }

    const printWindow = window.open('', '_blank');

    if (!printWindow) {
      this.notificationService.warning('No se pudo abrir la ventana de impresion.');
      return;
    }

    let tablaHtml = '';
    this.facturaDetalle.pedidos.forEach((pedido) => {
      if (pedido.estado === 'pendiente') {
        return;
      }

      pedido.items.forEach((item) => {
        tablaHtml += `<tr><td>${this.escaparHtml(String(item.cantidad))}</td><td>${this.escaparHtml(item.nombre)}<br><small>${this.escaparHtml(pedido.horaSolicitud || '')}</small></td><td>${this.formatearMoneda(item.precioUnit)}</td><td style="text-align:right;">${this.formatearMoneda(item.cantidad * item.precioUnit)}</td></tr>`;
      });
    });

    const anchoFactura = this.normalizarAnchoFactura(this.configuracionFactura.anchoFacturaCm);
    const titulo = this.escaparHtml(this.configuracionFactura.nombreBarVisible || this.nombreBarReal || this.nombreBar || 'Factura');
    const mesa = this.escaparHtml(String(this.facturaDetalle.numeroMesa || 'N/A'));
    const fecha = this.escaparHtml(this.formatearFecha(this.facturaDetalle.fechaCierre));
    const total = this.formatearMoneda(this.facturaDetalle.total);
    const bloquesInfo = [
      this.configuracionFactura.nitFactura ? `<p>NIT: ${this.escaparHtml(this.configuracionFactura.nitFactura)}</p>` : '',
      this.configuracionFactura.telefonoFactura ? `<p>Tel: ${this.escaparHtml(this.configuracionFactura.telefonoFactura)}</p>` : '',
      this.configuracionFactura.direccionFactura ? `<p>${this.escaparHtml(this.configuracionFactura.direccionFactura)}</p>` : ''
    ].join('');
    const logoHtml = this.configuracionFactura.logoFactura
      ? `<div class="logo"><img src="${this.configuracionFactura.logoFactura}" alt="Logo factura"></div>`
      : '';
    const mensajeHtml = this.configuracionFactura.mensajeFactura
      ? `<p class="mensaje">${this.escaparHtml(this.configuracionFactura.mensajeFactura)}</p>`
      : '';

    printWindow.document.write(`<html><head><title>Ticket</title><style>@page { size: ${anchoFactura}cm auto; margin: 0; } * { box-sizing: border-box; } body { width: ${anchoFactura}cm; margin: 0; padding: 0.35cm; font-family: monospace; font-size: 12px; color: #000; } .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; } .logo { margin-bottom: 8px; } .logo img { max-width: 100%; max-height: 80px; object-fit: contain; } .header h3 { margin: 0 0 6px; font-size: 18px; } .header p { margin: 3px 0; } table { width: 100%; margin: 15px 0; border-collapse: collapse; } th { border-bottom: 1px solid #000; text-align: left; } td, th { padding: 3px 0; vertical-align: top; } .total { border-top: 1px dashed #000; padding-top: 10px; text-align: right; font-weight: bold; font-size: 14px; } .mensaje { margin-top: 14px; text-align: center; font-weight: bold; }</style></head><body onload="window.print()"><div class="header">${logoHtml}<h3>${titulo}</h3>${bloquesInfo}<p>Mesa: ${mesa}<br>${fecha}</p></div><table><thead><tr><th>Cant</th><th>Producto</th><th>Precio</th><th style="text-align:right;">Subt</th></tr></thead><tbody>${tablaHtml}</tbody></table><div class="total">TOTAL: ${total}</div>${mensajeHtml}</body></html>`);
    printWindow.document.close();
  }

  trackByFacturaId(index: number, factura: FacturaHistorialView): string {
    return factura.id || String(index);
  }

  private construirInicioDia(fechaIso: string): Date {
    return new Date(`${fechaIso}T00:00:00`);
  }

  private construirFinDia(fechaIso: string): Date {
    return new Date(`${fechaIso}T23:59:59.999`);
  }

  private normalizarFechaFirestore(valor: any): Date {
    if (valor?.toDate && typeof valor.toDate === 'function') {
      return valor.toDate();
    }

    const fecha = new Date(valor);
    return Number.isNaN(fecha.getTime()) ? new Date() : fecha;
  }

  private normalizarFechaFirestoreOpcional(valor: any): Date | null {
    if (!valor) {
      return null;
    }

    if (valor?.toDate && typeof valor.toDate === 'function') {
      const fechaTs = valor.toDate();
      return Number.isNaN(fechaTs?.getTime?.()) ? null : fechaTs;
    }

    const fecha = new Date(valor);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }

  private normalizarPedidos(pedidos: any): FacturaPedidoView[] {
    if (!Array.isArray(pedidos)) {
      return [];
    }

    return pedidos.map((pedido: any, indexPedido: number) => {
      const items = Array.isArray(pedido?.items) ? pedido.items : [];
      return {
        idPedido: String(pedido?.idPedido || `pedido-${indexPedido}`),
        estado: String(pedido?.estado || ''),
        horaSolicitud: String(pedido?.horaSolicitud || ''),
        fechaSolicitud: String(pedido?.fechaSolicitud || ''),
        items: items.map((item: any, indexItem: number) => ({
          idProd: String(item?.idProd || `item-${indexItem}`),
          nombre: String(item?.nombre || ''),
          precioUnit: Number(item?.precioUnit || 0),
          cantidad: Math.max(0, Number(item?.cantidad || 0)),
          subtotal: Number(item?.subtotal || 0)
        }))
      };
    });
  }

  private calcularTotalFactura(factura: FacturaHistorialView): number {
    return factura.pedidos.reduce((totalCuenta, pedido) => {
      if (pedido.estado === 'pendiente') {
        return totalCuenta;
      }

      const subtotal = pedido.items.reduce((suma, item) => suma + (Number(item.precioUnit || 0) * Number(item.cantidad || 0)), 0);
      return totalCuenta + subtotal;
    }, 0);
  }

  private recalcularFacturaEditando() {
    if (!this.facturaEditando) {
      return;
    }

    this.facturaEditando.pedidos = this.facturaEditando.pedidos.map((pedido) => ({
      ...pedido,
      items: pedido.items.map((item) => ({
        ...item,
        subtotal: Number(item.precioUnit || 0) * Number(item.cantidad || 0)
      }))
    }));

    this.facturaEditando.total = this.calcularTotalFactura(this.facturaEditando);
  }

  private clonarFactura(factura: FacturaHistorialView): FacturaHistorialView {
    return {
      ...factura,
      fechaApertura: factura.fechaApertura ? new Date(factura.fechaApertura) : null,
      fechaCierre: new Date(factura.fechaCierre),
      pedidos: factura.pedidos.map((pedido) => ({
        ...pedido,
        items: pedido.items.map((item) => ({ ...item }))
      }))
    };
  }

  private formatearMoneda(valor: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0
    }).format(Number(valor || 0));
  }

  private formatearFecha(fecha: Date): string {
    return new Intl.DateTimeFormat('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(fecha);
  }

  private escucharConfiguracionFactura() {
    if (!this.nombreBar) {
      return;
    }

    if (this.barSubscription) {
      this.barSubscription.unsubscribe();
    }

    this.barSubscription = this.rockolaService.observarBar(this.nombreBar).subscribe((bar: any) => {
      this.configuracionFactura = {
        nombreBarVisible: bar?.nombreBarVisible || this.nombreBarReal || this.nombreBar,
        logoFactura: bar?.logoFactura || '',
        nitFactura: bar?.nitFactura || '',
        telefonoFactura: bar?.telefonoFactura || '',
        direccionFactura: bar?.direccionFactura || '',
        mensajeFactura: bar?.mensajeFactura || '',
        anchoFacturaCm: this.normalizarAnchoFactura(bar?.anchoFacturaCm)
      };
    });
  }

  private crearConfiguracionFactura(): ConfiguracionFacturaBar {
    return {
      nombreBarVisible: this.nombreBarReal || this.nombreBar,
      logoFactura: '',
      nitFactura: '',
      telefonoFactura: '',
      direccionFactura: '',
      mensajeFactura: '',
      anchoFacturaCm: 8
    };
  }

  private normalizarAnchoFactura(valor: any): number {
    const ancho = Number(valor);

    if (!Number.isFinite(ancho) || ancho <= 0) {
      return 8;
    }

    return Math.max(4, Math.min(12, Number(ancho.toFixed(2))));
  }

  private formatearFechaInput(fecha: Date): string {
    const yyyy = fecha.getFullYear();
    const mm = String(fecha.getMonth() + 1).padStart(2, '0');
    const dd = String(fecha.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private escaparHtml(valor: string): string {
    return String(valor || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
