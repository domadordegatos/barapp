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
    
    const nuevoPedido = {
      idPedido: this.firestore.createId(),
      items: items.map(item => ({
        idProd: item.id,
        nombre: item.nombre,
        precioUnit: item.precio,
        cantidad: item.cantidad,
        subtotal: item.precio * item.cantidad
      })),
      solicitadoPor: 'usuario',
      horaSolicitud: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
      fechaSolicitud: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long' }),
      estado: 'pendiente'
    };

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
         .where('visible', '==', true)
    ).valueChanges({ idField: 'id' });
  }

  observarCuentaActiva(idMesa: string) {
    return this.firestore.collection('cuentas_activas').doc(idMesa).valueChanges().pipe(
      map((cuenta: any) => cuenta ? { id: idMesa, ...cuenta } : null)
    );
  }
}
