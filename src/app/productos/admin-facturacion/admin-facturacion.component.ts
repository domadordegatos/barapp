import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { AdminService } from '../../services/admin.service';
import { MesasService, Mesa } from '../../services/mesas.service';
import { RockolaService } from '../../services/rockola.service';
import { Subscription, combineLatest } from 'rxjs';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-admin-facturacion',
  templateUrl: './admin-facturacion.component.html',
  styleUrls: ['./admin-facturacion.component.scss']
})
export class AdminFacturacionComponent implements OnInit, OnDestroy {
  @Input() nombreBar: string = '';
  @Input() nombreBarReal: string = '';

  mesasConEstado: any[] = [];
  cargando: boolean = true;
  detalleSeleccionado: any = null;
  observaciones: string = '';
  mesaActualizandoValor: string | null = null;
  servicioHabilitadoBar: boolean = true;
  actualizandoServicio: boolean = false;
  
  private subscripcion: Subscription | null = null;
  private servicioSubscription: Subscription | null = null;

  constructor(
    private adminService: AdminService,
    private mesasService: MesasService,
    private rockolaService: RockolaService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    if (this.nombreBar) {
      this.escucharEstadoServicio();
      this.escucharCambiosEnTiempoReal();
    }
  }

  ngOnDestroy(): void {
    if (this.subscripcion) this.subscripcion.unsubscribe();
    if (this.servicioSubscription) this.servicioSubscription.unsubscribe();
  }

  private escucharEstadoServicio() {
    if (this.servicioSubscription) {
      this.servicioSubscription.unsubscribe();
    }

    this.servicioSubscription = this.rockolaService.observarBar(this.nombreBar).subscribe((bar: any) => {
      this.servicioHabilitadoBar = bar?.servicioHabilitado !== false;
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
    let tablaHtml = '';
    this.detalleSeleccionado.pedidos.forEach((p: any) => {
      if (p.estado !== 'pendiente') {
        p.items.forEach((i: any) => {
          tablaHtml += `<tr><td>${i.cantidad}</td><td>${i.nombre} <br><small>${p.horaSolicitud}</small></td><td>$${i.precioUnit}</td><td style="text-align: right;">$${i.precioUnit * i.cantidad}</td></tr>`;
        });
      }
    });
    printWindow.document.write(`<html><head><title>Ticket</title><style>body { font-family: monospace; font-size: 12px; padding: 20px; color: #000; } .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; } table { width: 100%; margin: 15px 0; } th { border-bottom: 1px solid #000; text-align: left; } .total { border-top: 1px dashed #000; padding-top: 10px; text-align: right; font-weight: bold; font-size: 14px; }</style></head><body onload="window.print()"><div class="header"><h1>${this.nombreBar}</h1><p>Mesa: ${this.detalleSeleccionado.numeroMesa}<br>${new Date().toLocaleDateString()}</p></div><table><thead><tr><th>Cant</th><th>Producto</th><th>Precio</th><th style="text-align: right;">Subt</th></tr></thead><tbody>${tablaHtml}</tbody></table><div class="total">TOTAL: $${total}</div></body></html>`);
    printWindow.document.close();
  }
}
