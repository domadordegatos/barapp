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
  valorCompra: number;
}

interface KpiAnalitica {
  totalFacturado: number;
  totalCosto: number;
  tienesDatosCosto: boolean;
  margenBruto: number;
  margenPct: number;
  mesasAtendidas: number;
  ticketPromedio: number;
  tiempoPromedioMin: number;
  totalUnidadesVendidas: number;
  totalPropinas: number;
  tienePropinas: boolean;
  distribMetodoPago: { efectivo: number; tarjeta: number; mixto: number; sinDato: number };
  tieneDatosMetodoPago: boolean;
}

interface TopProductoAnalitica {
  nombre: string;
  unidades: number;
  ingresos: number;
  costo: number;
  margenPct: number;
  pct: number;
}

interface OperadorAnalitica {
  nombre: string;
  pedidos: number;
  ingresos: number;
  ticketPromedio: number;
  pct: number;
}

interface HoraPicoAnalitica {
  hora: number;
  label: string;
  cantidad: number;
  pct: number;
}

interface FacturaPedidoView {
  idPedido: string;
  estado: string;
  horaSolicitud: string;
  fechaSolicitud: string;
  operador: string;
  items: FacturaItemView[];
}

interface FacturaHistorialView {
  id: string;
  numeroMesa: number;
  total: number;
  propina: number;
  metodoPago: string;
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

  vistaActiva: 'lista' | 'analitica' = 'lista';
  ordenTopProd: 'unidades' | 'ingresos' = 'unidades';
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
    const hoy = this.formatearFechaInput(new Date());
    this.fechaInicio = hoy;
    this.fechaFin = hoy;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['nombreBar'] && this.nombreBar) {
      this.escucharConfiguracionFactura();
      this.buscarHistorialPorRango();
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

  get kpiAnalitica(): KpiAnalitica {
    const fs = this.historialFacturas.filter((f) => f.seleccionada);
    let totalFacturado = 0, totalCosto = 0, totalUnidadesVendidas = 0, totalMinMesa = 0, mesasConTiempo = 0;
    let tienesDatosCosto = false;
    let totalPropinas = 0, tienePropinas = false;
    const distribMetodoPago = { efectivo: 0, tarjeta: 0, mixto: 0, sinDato: 0 };
    let tieneDatosMetodoPago = false;
    for (const factura of fs) {
      totalFacturado += factura.total;
      if (factura.propina > 0) { totalPropinas += factura.propina; tienePropinas = true; }
      if (factura.metodoPago) {
        tieneDatosMetodoPago = true;
        if (factura.metodoPago === 'tarjeta') distribMetodoPago.tarjeta++;
        else if (factura.metodoPago === 'mixto') distribMetodoPago.mixto++;
        else distribMetodoPago.efectivo++;
      } else { distribMetodoPago.sinDato++; }
      if (factura.fechaApertura && factura.fechaCierre) {
        const min = (factura.fechaCierre.getTime() - factura.fechaApertura.getTime()) / 60000;
        if (min > 0 && min < 600) { totalMinMesa += min; mesasConTiempo++; }
      }
      for (const pedido of factura.pedidos) {
        if (pedido.estado === 'pendiente') continue;
        for (const item of pedido.items) {
          totalUnidadesVendidas += item.cantidad;
          if (item.valorCompra > 0) { tienesDatosCosto = true; totalCosto += item.valorCompra * item.cantidad; }
        }
      }
    }
    const margenBruto = totalFacturado - totalCosto;
    return {
      totalFacturado, totalCosto, tienesDatosCosto, margenBruto,
      margenPct: totalFacturado > 0 ? (margenBruto / totalFacturado) * 100 : 0,
      mesasAtendidas: fs.length,
      ticketPromedio: fs.length > 0 ? totalFacturado / fs.length : 0,
      tiempoPromedioMin: mesasConTiempo > 0 ? totalMinMesa / mesasConTiempo : 0,
      totalUnidadesVendidas, totalPropinas, tienePropinas, distribMetodoPago, tieneDatosMetodoPago
    };
  }

  get topProductosAnalitica(): TopProductoAnalitica[] {
    const fs = this.historialFacturas.filter((f) => f.seleccionada);
    const mapa = new Map<string, { nombre: string; unidades: number; ingresos: number; costo: number }>();
    for (const factura of fs) {
      for (const pedido of factura.pedidos) {
        if (pedido.estado === 'pendiente') continue;
        for (const item of pedido.items) {
          const existing = mapa.get(item.nombre);
          const ingreso = item.precioUnit * item.cantidad;
          const costo = (item.valorCompra || 0) * item.cantidad;
          if (existing) { existing.unidades += item.cantidad; existing.ingresos += ingreso; existing.costo += costo; }
          else { mapa.set(item.nombre, { nombre: item.nombre, unidades: item.cantidad, ingresos: ingreso, costo }); }
        }
      }
    }
    const sorted = Array.from(mapa.values()).sort((a, b) =>
      this.ordenTopProd === 'unidades' ? b.unidades - a.unidades : b.ingresos - a.ingresos
    );
    const top = sorted.slice(0, 10);
    const maxVal = this.ordenTopProd === 'unidades' ? (top[0]?.unidades || 1) : (top[0]?.ingresos || 1);
    return top.map((p) => ({
      nombre: p.nombre, unidades: p.unidades, ingresos: p.ingresos, costo: p.costo,
      margenPct: p.ingresos > 0 ? ((p.ingresos - p.costo) / p.ingresos) * 100 : 0,
      pct: Math.round(((this.ordenTopProd === 'unidades' ? p.unidades : p.ingresos) / maxVal) * 100)
    }));
  }

  get rankingOperadoresAnalitica(): OperadorAnalitica[] {
    const fs = this.historialFacturas.filter((f) => f.seleccionada);
    const mapa = new Map<string, { nombre: string; pedidos: number; ingresos: number }>();
    for (const factura of fs) {
      for (const pedido of factura.pedidos) {
        if (pedido.estado === 'pendiente') continue;
        const nombre = pedido.operador?.trim() || 'Sin operador';
        const ingreso = pedido.items.reduce((s, i) => s + i.precioUnit * i.cantidad, 0);
        const existing = mapa.get(nombre);
        if (existing) { existing.pedidos++; existing.ingresos += ingreso; }
        else { mapa.set(nombre, { nombre, pedidos: 1, ingresos: ingreso }); }
      }
    }
    const lista = Array.from(mapa.values()).sort((a, b) => b.ingresos - a.ingresos);
    const maxIng = lista[0]?.ingresos || 1;
    return lista.map((op) => ({
      nombre: op.nombre, pedidos: op.pedidos, ingresos: op.ingresos,
      ticketPromedio: op.pedidos > 0 ? op.ingresos / op.pedidos : 0,
      pct: Math.round((op.ingresos / maxIng) * 100)
    }));
  }

  get distribucionHorasAnalitica(): HoraPicoAnalitica[] {
    const conteo = new Array(24).fill(0) as number[];
    for (const factura of this.historialFacturas.filter((f) => f.seleccionada)) {
      conteo[factura.fechaCierre.getHours()]++;
    }
    const max = Math.max(...conteo, 1);
    return conteo.map((cantidad, hora) => ({
      hora,
      label: `${String(hora).padStart(2, '0')}h`,
      cantidad,
      pct: Math.round((cantidad / max) * 100)
    }));
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
          propina: Number(factura?.propina || 0),
          metodoPago: String(factura?.metodoPago || ''),
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

      const meseroHtml = pedido.operador ? ` &middot; ${this.escaparHtml(String(pedido.operador))}` : '';
      pedido.items.forEach((item) => {
        tablaHtml += `<tr><td>${this.escaparHtml(String(item.cantidad))}</td><td>${this.escaparHtml(item.nombre)}<br><small>${this.escaparHtml(pedido.horaSolicitud || '')}${meseroHtml}</small></td><td>${this.formatearMoneda(item.precioUnit)}</td><td style="text-align:right;">${this.formatearMoneda(item.cantidad * item.precioUnit)}</td></tr>`;
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
        operador: String(pedido?.operador || ''),
        items: items.map((item: any, indexItem: number) => ({
          idProd: String(item?.idProd || `item-${indexItem}`),
          nombre: String(item?.nombre || ''),
          precioUnit: Number(item?.precioUnit || 0),
          cantidad: Math.max(0, Number(item?.cantidad || 0)),
          subtotal: Number(item?.subtotal || 0),
          valorCompra: Number(item?.valorCompra || 0)
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
