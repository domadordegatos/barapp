import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { AdminService } from '../../services/admin.service';
import { MesasService, Mesa } from '../../services/mesas.service';
import { RockolaService } from '../../services/rockola.service';
import { Subscription, combineLatest } from 'rxjs';
import { NotificationService } from '../../services/notification.service';
import { Producto } from '../../interfaces/producto.interface';
import { VentasService } from '../../services/ventas-service.service';
import { ProductosService } from '../../services/productos.service';

type ProductoDisponibleAdmin = Producto & { id: string };

interface ItemPedidoAdmin {
  idProd: string;
  nombre: string;
  precioUnit: number;
  cantidad: number;
  subtotal: number;
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
  selector: 'app-admin-facturacion',
  templateUrl: './admin-facturacion.component.html',
  styleUrls: ['./admin-facturacion.component.scss']
})
export class AdminFacturacionComponent implements OnInit, OnDestroy {
  @Input() nombreBar: string = '';
  @Input() nombreBarReal: string = '';
  @Input() esAdmin: boolean = false;

  mesasConEstado: any[] = [];
  cargando: boolean = true;
  detalleSeleccionado: any = null;
  observaciones: string = '';
  mesaActualizandoValor: string | null = null;
  servicioHabilitadoBar: boolean = true;
  actualizandoServicio: boolean = false;
  mostrandoModalAgregarPedido: boolean = false;
  guardandoPedidoAdmin: boolean = false;
  busquedaProductoAdmin: string = '';
  mesaPedidoManual: string = '';
  mesaPedidoCoincidente: any | null = null;
  productosDisponiblesAdmin: ProductoDisponibleAdmin[] = [];
  resultadosBusquedaProductos: ProductoDisponibleAdmin[] = [];
  itemsPedidoAdmin: ItemPedidoAdmin[] = [];
  configuracionFactura: ConfiguracionFacturaBar = this.crearConfiguracionFactura();
  
  private subscripcion: Subscription | null = null;
  private servicioSubscription: Subscription | null = null;
  private productosSubscription: Subscription | null = null;

  constructor(
    private adminService: AdminService,
    private mesasService: MesasService,
    private rockolaService: RockolaService,
    private notificationService: NotificationService,
    private ventasService: VentasService,
    private productosService: ProductosService
  ) {}

  ngOnInit(): void {
    if (this.nombreBar) {
      this.cargarProductosDisponibles();
      this.escucharEstadoServicio();
      this.escucharCambiosEnTiempoReal();
    }
  }

  ngOnDestroy(): void {
    if (this.subscripcion) this.subscripcion.unsubscribe();
    if (this.servicioSubscription) this.servicioSubscription.unsubscribe();
    if (this.productosSubscription) this.productosSubscription.unsubscribe();
  }

  private escucharEstadoServicio() {
    if (this.servicioSubscription) {
      this.servicioSubscription.unsubscribe();
    }

    this.servicioSubscription = this.rockolaService.observarBar(this.nombreBar).subscribe((bar: any) => {
      this.servicioHabilitadoBar = bar?.servicioHabilitado !== false;
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

  escucharCambiosEnTiempoReal() {
    this.cargando = true;
    this.subscripcion = combineLatest([
      this.mesasService.getMesas(this.nombreBar),
      this.adminService.obtenerCuentasActivas(this.nombreBar)
    ]).subscribe({
      next: ([mesas, cuentas]: [any[], any[]]) => {
        const mesasActivas = mesas.filter(m => m.activa === true);

        this.mesasConEstado = mesasActivas.map((mesa: Mesa) => {
          this.asegurarConfiguracionMesa(mesa);
          const cuentaActiva = cuentas.find(c => c.idMesa === mesa.id);
          return {
            ...mesa,
            cuenta: cuentaActiva || null,
            ocupada: !!cuentaActiva,
            prioridadBase: this.obtenerPrioridadBase(mesa),
            tieneNotificacion: !!cuentaActiva?.notificacionPendiente
          };
        }).sort((mesaA, mesaB) => this.compararMesas(mesaA, mesaB));
        this.actualizarMesaPedidoCoincidente();
        this.cargando = false;
      },
      error: (err) => {
        console.error(err);
        this.cargando = false;
      }
    });
  }

  private asegurarConfiguracionMesa(mesa: Mesa) {
    if (!mesa.id || typeof mesa.mostrarValorCuenta === 'boolean') {
      return;
    }

    this.mesasService.actualizarVisibilidadValorCuenta(mesa.id, false).catch((error) => {
      console.error(error);
    });
  }

  private obtenerPrioridadBase(mesa: Mesa): number {
    if (typeof mesa.prioridadVisual === 'number' && !Number.isNaN(mesa.prioridadVisual)) {
      return mesa.prioridadVisual;
    }

    return mesa.numero;
  }

  private compararMesas(mesaA: any, mesaB: any): number {
    const notificacionA = mesaA.tieneNotificacion ? 0 : 1;
    const notificacionB = mesaB.tieneNotificacion ? 0 : 1;

    if (notificacionA !== notificacionB) {
      return notificacionA - notificacionB;
    }

    const ocupadaA = mesaA.ocupada ? 0 : 1;
    const ocupadaB = mesaB.ocupada ? 0 : 1;

    if (ocupadaA !== ocupadaB) {
      return ocupadaA - ocupadaB;
    }

    if (mesaA.prioridadBase !== mesaB.prioridadBase) {
      return mesaA.prioridadBase - mesaB.prioridadBase;
    }

    return mesaA.numero - mesaB.numero;
  }

  private cargarProductosDisponibles() {
    if (this.productosSubscription) {
      this.productosSubscription.unsubscribe();
    }

    this.productosSubscription = this.ventasService.obtenerProductos(this.normalizarNombreBar()).subscribe({
      next: (productos: any[]) => {
        this.productosDisponiblesAdmin = (productos || [])
          .filter((producto) => this.productoDisponibleParaPedido(producto))
          .sort((productoA, productoB) => {
            const nombreA = (productoA?.nombre || '').toString();
            const nombreB = (productoB?.nombre || '').toString();
            return nombreA.localeCompare(nombreB, 'es', { sensitivity: 'base' });
          });
        this.actualizarResultadosBusqueda();
      },
      error: (error) => {
        console.error(error);
        this.notificationService.error('No se pudieron cargar los productos para pedidos manuales.');
      }
    });
  }

  private productoDisponibleParaPedido(producto: any): boolean {
    if (producto?.visible === false || !producto?.disponible) {
      return false;
    }

    if (!producto.controlInventario) {
      return true;
    }

    return Number(producto.existencias || 0) > 0;
  }

  private normalizarNombreBar(): string {
    return (this.nombreBar || '').toLowerCase().replace(/\s+/g, '');
  }

  private normalizarTexto(valor: string): string {
    return (valor || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private normalizarAnchoFactura(valor: any): number {
    const ancho = Number(valor);

    if (!Number.isFinite(ancho) || ancho <= 0) {
      return 8;
    }

    return Math.max(4, Math.min(12, Number(ancho.toFixed(2))));
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

  async verDetalle(mesa: any) {
    if (!mesa.ocupada) return;
    this.detalleSeleccionado = mesa.cuenta;
    this.observaciones = this.detalleSeleccionado.observaciones || '';

    if (this.detalleSeleccionado.notificacionPendiente) {
      try {
        await this.adminService.actualizarCuenta(this.detalleSeleccionado.id, {
          notificacionPendiente: false
        });
      } catch (error) { console.error(error); }
    }
  }

  async alternarVisibilidadValorCuenta(mesa: any, event: Event) {
    event.stopPropagation();

    if (!mesa?.id || this.mesaActualizandoValor === mesa.id) {
      return;
    }

    this.mesaActualizandoValor = mesa.id;
    const nuevoEstado = !mesa.mostrarValorCuenta;

    try {
      await this.mesasService.actualizarVisibilidadValorCuenta(mesa.id, nuevoEstado);
      this.notificationService.success(
        nuevoEstado
          ? `Mesa #${mesa.numero}: visibilidad de valores activada.`
          : `Mesa #${mesa.numero}: visibilidad de valores desactivada.`
      );
    } catch (error) {
      console.error(error);
      this.notificationService.error('No se pudo actualizar la visibilidad de valores.');
    } finally {
      this.mesaActualizandoValor = null;
    }
  }

  async alternarEstadoServicio() {
    if (!this.esAdmin) {
      this.notificationService.warning('Solo un usuario admin puede modificar el estado del servicio.');
      return;
    }

    if (!this.nombreBar || this.actualizandoServicio) {
      return;
    }

    this.actualizandoServicio = true;
    const nuevoEstado = !this.servicioHabilitadoBar;

    try {
      await this.rockolaService.actualizarEstadoServicio(this.nombreBar, nuevoEstado, this.nombreBarReal || this.nombreBar);
      this.notificationService.success(
        nuevoEstado
          ? 'Servicio activado para este bar.'
          : 'Servicio pausado para este bar.'
      );
    } catch (error) {
      console.error(error);
      this.notificationService.error('No se pudo actualizar el estado del servicio.');
    } finally {
      this.actualizandoServicio = false;
    }
  }

  cerrarDetalle() {
    this.detalleSeleccionado = null;
    this.observaciones = '';
  }

  abrirModalAgregarPedido() {
    this.reiniciarPedidoAdmin();
    this.mostrandoModalAgregarPedido = true;
    this.actualizarResultadosBusqueda();
  }

  abrirModalAgregarPedidoParaMesa(mesa: any, event: Event) {
    event.stopPropagation();
    this.abrirModalAgregarPedido();
    this.mesaPedidoManual = String(mesa?.numero || '');
    this.actualizarMesaPedidoCoincidente();
  }

  cerrarModalAgregarPedido() {
    if (this.guardandoPedidoAdmin) {
      return;
    }

    this.mostrandoModalAgregarPedido = false;
    this.reiniciarPedidoAdmin();
  }

  actualizarResultadosBusqueda() {
    const termino = this.normalizarTexto(this.busquedaProductoAdmin);
    const productosBase = termino
      ? this.productosDisponiblesAdmin.filter((producto) => this.normalizarTexto(producto.nombre).includes(termino))
      : this.productosDisponiblesAdmin;

    this.resultadosBusquedaProductos = productosBase.slice(0, 12);
  }

  seleccionarPrimerResultado(event: Event) {
    event.preventDefault();

    if (this.resultadosBusquedaProductos.length === 0) {
      return;
    }

    this.agregarProductoAPedido(this.resultadosBusquedaProductos[0]);
  }

  agregarProductoAPedido(producto: ProductoDisponibleAdmin) {
    const itemExistente = this.itemsPedidoAdmin.find((item) => item.idProd === producto.id);

    if (itemExistente) {
      itemExistente.cantidad += 1;
      itemExistente.subtotal = itemExistente.cantidad * itemExistente.precioUnit;
    } else {
      this.itemsPedidoAdmin.push({
        idProd: producto.id,
        nombre: producto.nombre,
        precioUnit: producto.precio,
        cantidad: 1,
        subtotal: producto.precio
      });
    }

    this.busquedaProductoAdmin = '';
    this.actualizarResultadosBusqueda();
  }

  cambiarCantidadPedidoAdmin(indexItem: number, delta: number) {
    const item = this.itemsPedidoAdmin[indexItem];

    if (!item) {
      return;
    }

    item.cantidad += delta;

    if (item.cantidad <= 0) {
      this.itemsPedidoAdmin.splice(indexItem, 1);
      return;
    }

    item.subtotal = item.cantidad * item.precioUnit;
  }

  eliminarItemPedidoAdmin(indexItem: number) {
    this.itemsPedidoAdmin.splice(indexItem, 1);
  }

  actualizarMesaPedidoCoincidente() {
    const numeroMesa = Number(this.mesaPedidoManual);

    if (!Number.isInteger(numeroMesa) || numeroMesa <= 0) {
      this.mesaPedidoCoincidente = null;
      return;
    }

    this.mesaPedidoCoincidente = this.mesasConEstado.find((mesa) => {
      return mesa.ocupada && Number(mesa.numero) === numeroMesa && mesa.cuenta?.estado === 'abierta';
    }) || null;
  }

  obtenerTotalPedidoAdmin(): number {
    return this.itemsPedidoAdmin.reduce((total, item) => total + item.subtotal, 0);
  }

  async guardarPedidoAdmin() {
    if (this.guardandoPedidoAdmin) {
      return;
    }

    if (!this.mesaPedidoCoincidente?.cuenta?.id) {
      this.notificationService.warning('Ingresa un numero de mesa con cuenta activa.');
      return;
    }

    if (this.itemsPedidoAdmin.length === 0) {
      this.notificationService.warning('Agrega al menos un producto al pedido.');
      return;
    }

    this.guardandoPedidoAdmin = true;

    try {
      await this.productosService.guardarPedidoAprobadoEnCuenta(
        this.normalizarNombreBar(),
        this.mesaPedidoCoincidente.cuenta.id,
        Number(this.mesaPedidoManual),
        this.itemsPedidoAdmin
      );

      this.notificationService.success(`Pedido agregado a la mesa #${this.mesaPedidoCoincidente.numero}.`);
      this.cerrarModalAgregarPedido();
    } catch (error) {
      console.error(error);
      this.notificationService.error('No se pudo guardar el pedido manual en la cuenta.');
    } finally {
      this.guardandoPedidoAdmin = false;
    }
  }

  private reiniciarPedidoAdmin() {
    this.busquedaProductoAdmin = '';
    this.mesaPedidoManual = '';
    this.mesaPedidoCoincidente = null;
    this.itemsPedidoAdmin = [];
  }

  formatearMetaPedido(pedido: any): string {
    const partes: string[] = [];

    if (pedido?.horaSolicitud) {
      partes.push(pedido.horaSolicitud);
    }

    if (pedido?.fechaSolicitud) {
      partes.push(pedido.fechaSolicitud);
    }

    if (pedido?.solicitadoPor) {
      partes.push(this.formatearSolicitante(pedido.solicitadoPor));
    }

    return partes.join(' • ');
  }

  formatearSolicitante(valor: string): string {
    const normalizado = (valor || '').trim().toLowerCase();

    if (normalizado === 'usuario') {
      return 'Cliente';
    }

    if (normalizado === 'admin' || normalizado === 'administrador') {
      return 'Administrador';
    }

    if (!normalizado) {
      return 'Sin origen';
    }

    return valor.charAt(0).toUpperCase() + valor.slice(1);
  }

  formatearEstadoPedido(valor: string): string {
    const normalizado = (valor || '').trim().toLowerCase();

    if (normalizado === 'aceptado') {
      return 'Aceptado';
    }

    if (normalizado === 'pendiente') {
      return 'Pendiente';
    }

    if (normalizado === 'rechazado') {
      return 'Rechazado';
    }

    if (!normalizado) {
      return 'Sin estado';
    }

    return valor.charAt(0).toUpperCase() + valor.slice(1);
  }

  aprobarPedido(indexPedido: number) {
    if (this.detalleSeleccionado?.pedidos[indexPedido]) {
      this.detalleSeleccionado.pedidos[indexPedido].estado = 'aceptado';
    }
  }

  eliminarItem(indexPedido: number, indexItem: number) {
    const pedido = this.detalleSeleccionado.pedidos[indexPedido];
    if (confirm(`¿Eliminar ${pedido.items[indexItem].nombre}?`)) {
      pedido.items.splice(indexItem, 1);
      if (pedido.items.length === 0) this.detalleSeleccionado.pedidos.splice(indexPedido, 1);
    }
  }

  cambiarCantidad(idxPedido: number, idxItem: number, delta: number) {
    const item = this.detalleSeleccionado.pedidos[idxPedido].items[idxItem];
    if (item.cantidad + delta >= 0) {
      item.cantidad += delta;
      if (item.cantidad === 0) this.eliminarItem(idxPedido, idxItem);
    }
  }

  calcularTotalAprobado(): number {
    if (!this.detalleSeleccionado?.pedidos) return 0;
    return this.detalleSeleccionado.pedidos.reduce((totalGral: number, pedido: any) => {
      if (pedido.estado !== 'pendiente') {
        const subtotalPedido = pedido.items.reduce((suma: number, item: any) => suma + (item.precioUnit * item.cantidad), 0);
        return totalGral + subtotalPedido;
      }
      return totalGral;
    }, 0);
  }

  async guardarCambiosFinales() {
    if (!this.detalleSeleccionado) return;
    this.detalleSeleccionado.pedidos.forEach((p: any) => {
      p.items.forEach((i: any) => i.subtotal = i.precioUnit * i.cantidad);
    });
    try {
      await this.adminService.actualizarCuenta(this.detalleSeleccionado.id, {
        pedidos: this.detalleSeleccionado.pedidos,
        total: this.calcularTotalAprobado(),
        observaciones: this.observaciones
      });
      this.notificationService.success('Cambios guardados.');
    } catch (error) { console.error(error); }
  }

  async finalizarCuenta() {
    if (!confirm('¿Finalizar cuenta y liberar mesa?')) return;
    
    const cuentaFinalizada = {
      ...this.detalleSeleccionado,
      estado: 'cerrada',
      total: this.calcularTotalAprobado(),
      observaciones: this.observaciones,
      fechaCierre: new Date()
    };

    try {
      await this.adminService.archivarCuenta(cuentaFinalizada);
      this.notificationService.success('Cuenta cerrada y mesa liberada.');
      this.cerrarDetalle();
    } catch (error) {
      console.error(error);
      this.notificationService.error('Error al cerrar cuenta.');
    }
  }

  imprimirFactura() {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const total = this.calcularTotalAprobado();
    const anchoFactura = this.normalizarAnchoFactura(this.configuracionFactura.anchoFacturaCm);
    const nombreVisible = this.escaparHtml(this.configuracionFactura.nombreBarVisible || this.nombreBarReal || this.nombreBar);
    const mesa = this.escaparHtml(String(this.detalleSeleccionado.numeroMesa || ''));
    const fechaActual = this.escaparHtml(new Date().toLocaleDateString());
    let tablaHtml = '';
    this.detalleSeleccionado.pedidos.forEach((p: any) => {
      if (p.estado !== 'pendiente') {
        p.items.forEach((i: any) => {
          tablaHtml += `<tr><td>${this.escaparHtml(String(i.cantidad))}</td><td>${this.escaparHtml(i.nombre)} <br><small>${this.escaparHtml(p.horaSolicitud || '')}</small></td><td>${this.formatearMonedaFactura(i.precioUnit)}</td><td style="text-align: right;">${this.formatearMonedaFactura(i.precioUnit * i.cantidad)}</td></tr>`;
        });
      }
    });
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

    printWindow.document.write(`<html><head><title>Ticket</title><style>@page { size: ${anchoFactura}cm auto; margin: 0; } * { box-sizing: border-box; } body { width: ${anchoFactura}cm; margin: 0; padding: 0.35cm; font-family: monospace; font-size: 12px; color: #000; } .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; } .logo { margin-bottom: 8px; } .logo img { max-width: 100%; max-height: 80px; object-fit: contain; } .header h1 { margin: 0 0 6px; font-size: 18px; } .header p { margin: 3px 0; } table { width: 100%; margin: 15px 0; border-collapse: collapse; } th { border-bottom: 1px solid #000; text-align: left; } td, th { padding: 3px 0; vertical-align: top; } .total { border-top: 1px dashed #000; padding-top: 10px; text-align: right; font-weight: bold; font-size: 14px; } .mensaje { margin-top: 14px; text-align: center; font-weight: bold; }</style></head><body onload="window.print()"><div class="header">${logoHtml}<h1>${nombreVisible}</h1>${bloquesInfo}<p>Mesa: ${mesa}<br>${fechaActual}</p></div><table><thead><tr><th>Cant</th><th>Producto</th><th>Precio</th><th style="text-align: right;">Subt</th></tr></thead><tbody>${tablaHtml}</tbody></table><div class="total">TOTAL: ${this.formatearMonedaFactura(total)}</div>${mensajeHtml}</body></html>`);
    printWindow.document.close();
  }

  private formatearMonedaFactura(valor: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0
    }).format(Number(valor || 0));
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
