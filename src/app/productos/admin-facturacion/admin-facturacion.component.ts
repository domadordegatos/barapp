import { Component, Input, OnInit } from '@angular/core';
import { AdminService } from '../../services/admin.service';

@Component({
  selector: 'app-admin-facturacion',
  templateUrl: './admin-facturacion.component.html',
  styleUrls: ['./admin-facturacion.component.scss']
})
export class AdminFacturacionComponent implements OnInit {
  @Input() nombreBar: string = '';

  fechaInicio: string = '';
  fechaFin: string = '';
  facturas: any[] = [];
  cargando: boolean = false;
  detalleSeleccionado: any = null;

  constructor(private adminService: AdminService) {
    this.establecerFechaHoy();
  }

  ngOnInit(): void {
    if (this.nombreBar) {
      this.buscarSesiones();
    }
  }

  establecerFechaHoy() {
    const ahora = new Date();
    const anio = ahora.getFullYear();
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const dia = String(ahora.getDate()).padStart(2, '0');
    this.fechaInicio = `${anio}-${mes}-${dia}`;
    this.fechaFin = `${anio}-${mes}-${dia}`;
  }

  async buscarSesiones() {
    if (!this.nombreBar) return;
    this.cargando = true;

    const inicio = new Date(this.fechaInicio + 'T00:00:00');
    const fin = new Date(this.fechaFin + 'T23:59:59');

    this.adminService.obtenerTokensPorRango(this.nombreBar, inicio, fin)
      .subscribe({
        next: (data: any[]) => {
          this.facturas = data;
          this.cargando = false;
        },
        error: (error) => {
          console.error("Error en búsqueda:", error);
          this.cargando = false;
        }
      });
  }

  async verDetalle(factura: any) {
    this.detalleSeleccionado = factura;

    if (factura.notificacionPendiente) {
      try {
        await this.adminService.actualizarCuenta(factura.id, {
          notificacionPendiente: false
        });
        factura.notificacionPendiente = false;
      } catch (error) {
        console.error("Error al limpiar notificación:", error);
      }
    }
  }

  cerrarDetalle() {
    this.detalleSeleccionado = null;
  }

  obtenerClaseEstado(estado: string): string {
    switch (estado) {
      case 'abierta': return 'estado-ocupada';
      case 'cerrada': return 'estado-pagada';
      default: return 'estado-otro';
    }
  }

  aprobarPedido(indexPedido: number) {
    if (this.detalleSeleccionado && this.detalleSeleccionado.pedidos[indexPedido]) {
      this.detalleSeleccionado.pedidos[indexPedido].estado = 'aceptado';
    }
  }

  eliminarItem(indexPedido: number, indexItem: number) {
    const pedido = this.detalleSeleccionado.pedidos[indexPedido];
    if (confirm(`¿Deseas eliminar ${pedido.items[indexItem].nombre}?`)) {
      pedido.items.splice(indexItem, 1);
      if (pedido.items.length === 0) {
        this.detalleSeleccionado.pedidos.splice(indexPedido, 1);
      }
    }
  }

  cambiarCantidad(idxPedido: number, idxItem: number, delta: number) {
    const item = this.detalleSeleccionado.pedidos[idxPedido].items[idxItem];
    if (item.cantidad + delta >= 0) {
      item.cantidad += delta;
      if (item.cantidad === 0) {
        this.eliminarItem(idxPedido, idxItem);
      }
    }
  }

  calcularTotalAprobado(): number {
    if (!this.detalleSeleccionado || !this.detalleSeleccionado.pedidos) return 0;
    
    return this.detalleSeleccionado.pedidos.reduce((totalGral: number, pedido: any) => {
      if (pedido.estado !== 'pendiente') {
        const subtotalPedido = pedido.items.reduce((suma: number, item: any) => {
          const precio = item.precioUnit || 0;
          const cantidad = item.cantidad || 0;
          return suma + (precio * cantidad);
        }, 0);
        return totalGral + subtotalPedido;
      }
      return totalGral;
    }, 0);
  }

  async guardarCambiosFinales() {
    if (!this.detalleSeleccionado) return;
    this.cargando = true;

    this.detalleSeleccionado.pedidos.forEach((pedido: any) => {
      pedido.items.forEach((item: any) => {
        item.subtotal = item.precioUnit * item.cantidad;
      });
    });

    const totalCalculado = this.calcularTotalAprobado();

    try {
      await this.adminService.actualizarCuenta(this.detalleSeleccionado.id, {
        pedidos: this.detalleSeleccionado.pedidos,
        total: totalCalculado
      });
      alert('Base de datos sincronizada correctamente.');
      this.cerrarDetalle();
    } catch (error) {
      console.error("Error al sincronizar:", error);
    } finally {
      this.cargando = false;
    }
  }
}
