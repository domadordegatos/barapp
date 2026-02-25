import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { map } from 'rxjs/operators';
import firebase from 'firebase/compat/app'; 
import 'firebase/compat/firestore'; // Esto registra los FieldValues

@Injectable({
  providedIn: 'root'
})
export class ProductosService {

  constructor(private firestore: AngularFirestore) {}
// productos.service.ts
async guardarPedidoEnCuenta(
  nombreBar: string, 
  idMesa: string, 
  numeroMesa: number | null, 
  items: any[],
  token: string // <--- Nuevo argumento
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
    horaSolicitud: new Date().toLocaleTimeString(),
    estado: 'pendiente'
  };

  const doc = await cuentaRef.get().toPromise();

  if (!doc?.exists) {
    // Si la cuenta es nueva, grabamos el token que inició la sesión
    return cuentaRef.set({
      idMesa,
      numeroMesa,
      nombreBar,
      tokenSesion: token, // <--- AQUÍ SE GUARDA EL TOKEN
      idSesion: `SES-${Date.now()}`,
      estado: 'abierta',
      fechaApertura: new Date(),
      totalAcumulado: 0,
      visibilidadPreciosUsuario: false, 
      pedidos: [nuevoPedido]
    });
  } else {
    // Si la cuenta ya existe, solo anexamos el pedido. 
    // El token ya está en el documento desde que se abrió.
    return cuentaRef.update({
      pedidos: firebase.firestore.FieldValue.arrayUnion(nuevoPedido)
    });
  }
}
  // --- CATEGORÍAS ---
  obtenerCategorias(nombreBar: string) {
    return this.firestore.collection('categorias_bares', ref => 
      ref.where('nombreBar', '==', nombreBar)
         .where('activo', '==', true)
    ).valueChanges({ idField: 'id' });
  }

  // --- PRODUCTOS ---
  obtenerProductosPorCategoria(nombreBar: string, categoriaNombre: string) {
    return this.firestore.collection('productos', ref => 
      ref.where('nombreBar', '==', nombreBar)
         .where('categoria', '==', categoriaNombre)
         .where('visible', '==', true)
    ).valueChanges({ idField: 'id' });
  }

  // --- GESTIÓN DE PEDIDOS ---
  async crearPedido(pedido: any) {
    // Retorna la promesa para manejar loading/errores en el componente
    return this.firestore.collection('pedidos_productos').add({
      ...pedido,
      fechaHora: new Date(),
      estado: 'pendiente'
    });
  }

  // --- FUTURAS FUNCIONALIDADES (Ejemplos) ---
  actualizarStock(productoId: string, nuevaCantidad: number) {
    return this.firestore.collection('productos').doc(productoId).update({
      existencias: nuevaCantidad
    });
  }
}