import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { AdminService } from '../../services/admin.service';
import { MesasService, Mesa } from '../../services/mesas.service';
import { Subscription, combineLatest } from 'rxjs';

@Component({
  selector: 'app-admin-facturacion',
  templateUrl: './admin-facturacion.component.html',
  styleUrls: ['./admin-facturacion.component.scss']
})
export class AdminFacturacionComponent implements OnInit, OnDestroy {
  @Input() nombreBar: string = '';

  mesasConEstado: any[] = [];
  cargando: boolean = true;
  detalleSeleccionado: any = null;
  observaciones: string = '';
  
  private subscripcion: Subscription | null = null;

  constructor(
    private adminService: AdminService,
    private mesasService: MesasService
  ) {}

  ngOnInit(): void {
    if (this.nombreBar) {
      this.escucharCambiosEnTiempoReal();
    }
  }

  ngOnDestroy(): void {
    if (this.subscripcion) this.subscripcion.unsubscribe();
  }

  escucharCambiosEnTiempoReal() {
    this.cargando = true;
    this.subscripcion = combineLatest([
      this.mesasService.getMesas(this.nombreBar),
      this.adminService.obtenerCuentasActivas(this.nombreBar)
    ]).subscribe({
      next: ([mesas, cuentas]: [any[], any[]]) => {
        
        // CORRECCIÓN: Filtramos para mostrar solo las mesas activas
        const mesasActivas = mesas.filter(m => m.activa === true);

        this.mesasConEstado = mesasActivas.map(mesa => {
          const cuentaActiva = cuentas.find(c => c.idMesa === mesa.id);
          return {
            ...mesa,
            cuenta: cuentaActiva || null,
            ocupada: !!cuentaActiva
          };
        });
        this.cargando = false;
      },
      error: (err) => {
        console.error(err);
        this.cargando = false;
      }
    });
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

  cerrarDetalle() {
    this.detalleSeleccionado = null;
    this.observaciones = '';
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
      alert('Guardado.');
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
      alert('Cuenta cerrada y mesa liberada.');
      this.cerrarDetalle();
    } catch (error) {
      console.error(error);
      alert('Error al cerrar cuenta.');
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
