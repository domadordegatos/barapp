import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { RockolaService } from '../services/rockola.service';
import { trigger, transition, style, animate, group, query } from '@angular/animations';
import { Producto } from '../interfaces/producto.interface';
import { ProductosService } from '../services/productos.service';
import { NotificationService } from '../services/notification.service';
import { Subscription } from 'rxjs';

interface HistorialItemCuenta {
  id: string;
  nombre: string;
  cantidad: number;
  precioUnit: number;
  subtotal: number;
}

interface HistorialPedidoAprobado {
  idPedido: string;
  fechaSolicitud: string;
  horaSolicitud: string;
  items: HistorialItemCuenta[];
  totalPedido: number;
}

@Component({
  selector: 'app-dashboard-mesa',
  templateUrl: './dashboard-mesa.component.html',
  styleUrls: ['./dashboard-mesa.component.scss'],
  animations: [
    trigger('slideContent', [
      transition('songs => products', [
        group([
          query(':enter', [
            style({ transform: 'translateX(100%)', opacity: 0 }),
            animate('400ms ease-out', style({ transform: 'translateX(0%)', opacity: 1 }))
          ], { optional: true }),
          query(':leave', [
            animate('400ms ease-out', style({ transform: 'translateX(-100%)', opacity: 0 }))
          ], { optional: true })
        ])
      ]),
      transition('products => songs', [
        group([
          query(':enter', [
            style({ transform: 'translateX(-100%)', opacity: 0 }),
            animate('400ms ease-out', style({ transform: 'translateX(0%)', opacity: 1 }))
          ], { optional: true }),
          query(':leave', [
            animate('400ms ease-out', style({ transform: 'translateX(100%)', opacity: 0 }))
          ], { optional: true })
        ])
      ])
    ])
  ]
})
export class DashboardMesaComponent implements OnInit, OnDestroy {
  nombreBarUrl: string = '';
  idMesaUrl: string = '';
  numeroMesaReal: number | null = null;
  nombreBarReal: string = ''; 
  mesaValida: boolean = false;

  carrito: (Producto & { id: string, cantidad: number })[] = [];
  mostrandoResumenPedido: boolean = false;
  mostrandoHistorialCuenta: boolean = false;
  mostrarAvisoHistorialSinPrecios: boolean = false;
  enviandoPedido: boolean = false;
  resetCarritoFlag: boolean = false;

  barValido: boolean = false;
  errorMensaje: string = '';
  cargandoValidacion: boolean = true;
  codigoIngresado: string = '';
  accesoAutorizado: boolean = false;
  servicioHabilitadoBar: boolean = true;
  vistaActual: 'songs' | 'products' = 'songs';
  mostrarValorCuentaCliente: boolean = false;
  historialPedidosAprobados: HistorialPedidoAprobado[] = [];

  private barSubscription: Subscription | null = null;
  private mesaSubscription: Subscription | null = null;
  private cuentaSubscription: Subscription | null = null;
  private avisoHistorialTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private route: ActivatedRoute,
    private rockolaService: RockolaService,
    private productosService: ProductosService,
    private notificationService: NotificationService
  ) {}

  // Clave única: CODIGO_BAR_IDMESA
  get storageKey(): string {
    return `codigo_${this.nombreBarUrl.toLowerCase()}_${this.idMesaUrl}`;
  }

  private debeActualizarNombreVisible(nombreEntrante: string): boolean {
    if (!nombreEntrante.trim()) {
      return false;
    }

    if (!this.nombreBarReal.trim()) {
      return true;
    }

    const actualNormalizado = this.nombreBarReal.toLowerCase().trim().replace(/\s+/g, '');
    const entranteNormalizado = nombreEntrante.toLowerCase().trim().replace(/\s+/g, '');

    if (entranteNormalizado !== this.nombreBarUrl) {
      return true;
    }

    return actualNormalizado === this.nombreBarReal.toLowerCase().trim() && entranteNormalizado === this.nombreBarUrl;
  }

  private asignarNombreBarVisible(nombreEntrante: string) {
    if (this.debeActualizarNombreVisible(nombreEntrante)) {
      this.nombreBarReal = nombreEntrante.trim();
    }
  }

  async ngOnInit() {
    const parametroUrl = this.route.snapshot.paramMap.get('nombreBar') || '';
    this.nombreBarUrl = parametroUrl.toLowerCase().trim().replace(/\s+/g, ''); 
    this.idMesaUrl = this.route.snapshot.paramMap.get('idMesa') || '';

    await this.verificarExistenciaDelBar();

    if (this.barValido) {
      await this.obtenerDatosDeLaMesa();
      if (this.mesaValida) {
        await this.verificarSesionExistente();
      } else {
        localStorage.removeItem(this.storageKey);
      }
    }
    
    this.cargandoValidacion = false;
  }

  ngOnDestroy(): void {
    if (this.barSubscription) {
      this.barSubscription.unsubscribe();
    }

    if (this.mesaSubscription) {
      this.mesaSubscription.unsubscribe();
    }

    if (this.cuentaSubscription) {
      this.cuentaSubscription.unsubscribe();
    }

    this.limpiarTimeoutAvisoHistorial();
  }

  get codigoAccesoVigente(): string {
    return localStorage.getItem(this.storageKey) || '';
  }

  get totalHistorialAprobado(): number {
    return this.historialPedidosAprobados.reduce((total, pedido) => total + pedido.totalPedido, 0);
  }

  async verificarExistenciaDelBar() {
    try {
      const datosBar: any = await this.rockolaService.verificarExistenciaBar(this.nombreBarUrl);
      if (datosBar) {
        this.barValido = true;
        this.asignarNombreBarVisible(datosBar.nombreBarVisible || datosBar.nombreBar || '');
        this.aplicarEstadoServicio(datosBar);
        this.escucharEstadoBar();
      } else {
        this.barValido = false;
        this.errorMensaje = `El bar no existe.`;
      }
    } catch (error) {
      this.barValido = false;
      this.errorMensaje = "Error de conexión.";
    }
  }

  private escucharEstadoBar() {
    if (this.barSubscription) {
      this.barSubscription.unsubscribe();
    }

    this.barSubscription = this.rockolaService.observarBar(this.nombreBarUrl).subscribe((bar: any) => {
      if (!bar) {
        return;
      }

      this.asignarNombreBarVisible(bar.nombreBarVisible || bar.nombreBar || '');
      this.aplicarEstadoServicio(bar);
    });
  }

  private aplicarEstadoServicio(bar: any) {
    const estabaHabilitado = this.servicioHabilitadoBar;
    this.servicioHabilitadoBar = bar?.servicioHabilitado !== false;

    if (!this.servicioHabilitadoBar) {
      this.codigoIngresado = '';
      this.mostrandoResumenPedido = false;
      this.cerrarHistorialCuenta();
      return;
    }

    if (!estabaHabilitado && !this.accesoAutorizado && this.mesaValida) {
      this.verificarSesionExistente();
    }
  }

  async obtenerDatosDeLaMesa() {
    const datosMesa = await this.rockolaService.obtenerMesaValidaDelBar(this.idMesaUrl, this.nombreBarUrl);

    if (datosMesa) {
      this.mesaValida = true;
      this.numeroMesaReal = datosMesa.numero;
      this.mostrarValorCuentaCliente = !!datosMesa.mostrarValorCuenta;
      this.escucharConfiguracionMesa();
      return;
    }

    this.mesaValida = false;
    this.errorMensaje = 'La mesa no existe, no esta activa o no pertenece a este bar.';
  }

  private escucharConfiguracionMesa() {
    if (this.mesaSubscription) {
      this.mesaSubscription.unsubscribe();
    }

    this.mesaSubscription = this.rockolaService.observarMesa(this.idMesaUrl).subscribe((mesa: any) => {
      this.mostrarValorCuentaCliente = !!mesa?.mostrarValorCuenta;
    });
  }

  async verificarSesionExistente() {
    if (!this.mesaValida || !this.servicioHabilitadoBar) {
      this.accesoAutorizado = false;
      return;
    }

    const codigoGuardado = localStorage.getItem(this.storageKey);
    if (codigoGuardado) {
      const esValido = await this.rockolaService.validarCodigoBar(this.nombreBarUrl, codigoGuardado);
      if (esValido) {
        this.accesoAutorizado = true;
        this.escucharCuentaActiva();
      } else {
        localStorage.removeItem(this.storageKey);
        this.accesoAutorizado = false;
      }
    }
  }

  async validarAcceso() {
    if (!this.mesaValida || !this.servicioHabilitadoBar) {
      this.accesoAutorizado = false;
      if (!this.servicioHabilitadoBar) {
        this.notificationService.warning('En este momento el bar no tiene servicio habilitado.');
      }
      return;
    }

    if (this.codigoIngresado.length !== 4) return;
    
    const esValido = await this.rockolaService.validarCodigoBar(this.nombreBarUrl, this.codigoIngresado);
    if (esValido) {
      localStorage.setItem(this.storageKey, this.codigoIngresado);
      this.accesoAutorizado = true;
      this.escucharCuentaActiva();
    } else {
      this.notificationService.error('Código incorrecto.');
      this.codigoIngresado = '';
    }
  }

  onCarritoActualizado(carrito: any[]) {
    this.carrito = carrito;
  }

  private escucharCuentaActiva() {
    if (this.cuentaSubscription) {
      this.cuentaSubscription.unsubscribe();
    }

    this.cuentaSubscription = this.productosService.observarCuentaActiva(this.idMesaUrl).subscribe((cuenta: any) => {
      this.historialPedidosAprobados = this.construirHistorialAprobado(cuenta);
    });
  }

  private construirHistorialAprobado(cuenta: any): HistorialPedidoAprobado[] {
    const pedidos = Array.isArray(cuenta?.pedidos) ? cuenta.pedidos : [];

    return pedidos
      .filter((pedido: any) => pedido?.estado === 'aceptado')
      .map((pedido: any, pedidoIndex: number) => {
        const items = Array.isArray(pedido.items) ? pedido.items : [];
        const itemsNormalizados = items.map((item: any, itemIndex: number) => ({
          id: item.idProd || `${pedido.idPedido || pedidoIndex}-${itemIndex}`,
          nombre: item.nombre || 'Producto',
          cantidad: Number(item.cantidad || 0),
          precioUnit: Number(item.precioUnit || 0),
          subtotal: Number(item.subtotal || (item.precioUnit || 0) * (item.cantidad || 0))
        }));

        return {
          idPedido: pedido.idPedido || `pedido-${pedidoIndex}`,
          fechaSolicitud: pedido.fechaSolicitud || 'Pedido registrado',
          horaSolicitud: pedido.horaSolicitud || '',
          items: itemsNormalizados,
          totalPedido: itemsNormalizados.reduce((total, item) => total + item.subtotal, 0)
        };
      });
  }

  obtenerSubtotalItem(item: Producto & { id: string, cantidad: number }): number {
    return item.precio * item.cantidad;
  }

  trackByCarritoId(index: number, item: Producto & { id: string, cantidad: number }): string {
    return item.id;
  }

  trackByHistorialPedidoId(index: number, pedido: HistorialPedidoAprobado): string {
    return pedido.idPedido;
  }

  trackByHistorialItemId(index: number, item: HistorialItemCuenta): string {
    return item.id;
  }

  abrirHistorialCuenta() {
    this.mostrandoHistorialCuenta = true;
    this.mostrarAvisoHistorialSinPrecios = !this.mostrarValorCuentaCliente;

    this.limpiarTimeoutAvisoHistorial();

    if (this.mostrarAvisoHistorialSinPrecios) {
      this.avisoHistorialTimeout = setTimeout(() => {
        this.mostrarAvisoHistorialSinPrecios = false;
      }, 2800);
    }
  }

  cerrarHistorialCuenta() {
    this.mostrandoHistorialCuenta = false;
    this.mostrarAvisoHistorialSinPrecios = false;
    this.limpiarTimeoutAvisoHistorial();
  }

  resumenPedidoHistorial(pedido: HistorialPedidoAprobado, index: number): string {
    const partes = [`Pedido ${index + 1}`];
    const fecha = this.formatearFechaHistorial(pedido.fechaSolicitud);

    if (fecha) {
      partes.push(fecha);
    }

    if (pedido.horaSolicitud) {
      partes.push(pedido.horaSolicitud);
    }

    return partes.join(' • ');
  }

  private formatearFechaHistorial(fecha: string): string {
    if (!fecha) {
      return '';
    }

    const meses: Record<string, string> = {
      enero: 'ene', febrero: 'feb', marzo: 'mar', abril: 'abr', mayo: 'may', junio: 'jun',
      julio: 'jul', agosto: 'ago', septiembre: 'sep', setiembre: 'sep', octubre: 'oct', noviembre: 'nov', diciembre: 'dic'
    };

    const texto = fecha.toLowerCase().trim();
    const match = texto.match(/(\d{1,2})\s+de\s+([a-záéíóú]+)(?:\s+de\s+(\d{2,4}))?/i);

    if (!match) {
      return fecha;
    }

    const dia = match[1].padStart(2, '0');
    const mes = meses[match[2]] || match[2].slice(0, 3);
    const anio = match[3];

    return anio ? `${dia} ${mes} ${anio}` : `${dia} ${mes}`;
  }

  private limpiarTimeoutAvisoHistorial() {
    if (this.avisoHistorialTimeout) {
      clearTimeout(this.avisoHistorialTimeout);
      this.avisoHistorialTimeout = null;
    }
  }

  async confirmarPedido() {
    if (this.enviandoPedido) return;
    this.enviandoPedido = true;
    try {
      await this.productosService.guardarPedidoEnCuenta(
        this.nombreBarUrl,
        this.idMesaUrl,
        this.numeroMesaReal,
        this.carrito,
        this.codigoAccesoVigente
      );
      this.notificationService.success('Pedido enviado.');
      this.resetCarritoFlag = true;
      setTimeout(() => this.resetCarritoFlag = false, 100);
      this.carrito = [];
      this.mostrandoResumenPedido = false;
    } catch (error) {
      console.error(error);
      this.notificationService.error('Error al enviar pedido.');
    } finally {
      this.enviandoPedido = false;
    }
  }
}
