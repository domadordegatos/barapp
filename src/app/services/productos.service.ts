import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import firebase from 'firebase/compat/app'; 
import 'firebase/compat/firestore';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ProductosService {

  constructor(private firestore: AngularFirestore) {}

  async guardarPedidoEnCuenta(
    nombreBar: string, 
    idMesa: string, 
    numeroMesa: number | null, 
    items: any[],
    token: string
  ) {
    const cuentaRef = this.firestore.collection('cuentas_activas').doc(idMesa);
    const nuevoPedido = this.crearPedidoCuenta(items, 'usuario', 'pendiente');

    const doc = await cuentaRef.get().toPromise();

    // Si no existe O si la cuenta que hay está cerrada (aunque no debería estar ahí)
    if (!doc?.exists || doc.data()?.['estado'] === 'cerrada') {
      return cuentaRef.set({
        idMesa,
        numeroMesa,
        nombreBar,
        tokenSesion: token,
        idSesion: `SES-${Date.now()}`,
        estado: 'abierta',
        fechaApertura: new Date(),
        total: 0,
        notificacionPendiente: true,
        visibilidadPreciosUsuario: false, 
        pedidos: [nuevoPedido]
      });
    } else {
      return cuentaRef.update({
        pedidos: firebase.firestore.FieldValue.arrayUnion(nuevoPedido),
        notificacionPendiente: true
      });
    }
  }

  async guardarPedidoAprobadoEnCuenta(
    nombreBar: string,
    idMesa: string,
    numeroMesa: number,
    items: any[]
  ) {
    const cuentaRef = this.firestore.collection('cuentas_activas').doc(idMesa);
    const doc = await cuentaRef.get().toPromise();

    if (!doc?.exists) {
      throw new Error('La cuenta activa no existe para esta mesa.');
    }

    const cuenta = doc.data() as any;

    if (cuenta?.estado === 'cerrada') {
      throw new Error('La cuenta de esta mesa ya fue cerrada.');
    }

    if (Number(cuenta?.numeroMesa) !== Number(numeroMesa)) {
      throw new Error('El numero de mesa no coincide con la cuenta activa.');
    }

    const pedidoAdmin = this.crearPedidoCuenta(items, 'admin', 'aceptado');
    const pedidosActuales = Array.isArray(cuenta?.pedidos) ? cuenta.pedidos : [];
    const pedidosActualizados = [...pedidosActuales, pedidoAdmin];

    return cuentaRef.update({
      nombreBar,
      numeroMesa,
      pedidos: pedidosActualizados,
      total: this.calcularTotalCuenta(pedidosActualizados),
      notificacionPendiente: false
    });
  }

  obtenerCategorias(nombreBar: string) {
    return this.firestore.collection('categorias_bares', ref => 
      ref.where('nombreBar', '==', nombreBar)
         .where('activo', '==', true)
    ).valueChanges({ idField: 'id' });
  }

  obtenerProductosPorCategoria(nombreBar: string, categoriaNombre: string) {
    return this.firestore.collection('productos', ref => 
      ref.where('nombreBar', '==', nombreBar)
         .where('categoria', '==', categoriaNombre)
    ).valueChanges({ idField: 'id' });
  }

  observarCuentaActiva(idMesa: string) {
    return this.firestore.collection('cuentas_activas').doc(idMesa).valueChanges().pipe(
      map((cuenta: any) => cuenta ? { id: idMesa, ...cuenta } : null)
    );
  }

  private crearPedidoCuenta(items: any[], solicitadoPor: 'usuario' | 'admin', estado: 'pendiente' | 'aceptado') {
    return {
      idPedido: this.firestore.createId(),
      items: items.map(item => ({
        idProd: item.idProd || item.id,
        nombre: item.nombre,
        precioUnit: item.precioUnit ?? item.precio,
        valorCompra: item.valorCompra ?? 0,
        cantidad: item.cantidad,
        subtotal: (item.precioUnit ?? item.precio) * item.cantidad
      })),
      solicitadoPor,
      horaSolicitud: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
      fechaSolicitud: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long' }),
      estado
    };
  }

  private calcularTotalCuenta(pedidos: any[]): number {
    return pedidos.reduce((totalCuenta, pedido) => {
      if (pedido?.estado === 'pendiente') {
        return totalCuenta;
      }

      const items = Array.isArray(pedido?.items) ? pedido.items : [];
      const subtotalPedido = items.reduce((subtotal: number, item: any) => {
        return subtotal + ((item?.precioUnit || 0) * (item?.cantidad || 0));
      }, 0);

      return totalCuenta + subtotalPedido;
    }, 0);
  }
}
