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
  token: string
) {
  const cuentaRef = this.firestore.collection('cuentas_activas').doc(idMesa);
  
// productos.service.ts
// productos.service.ts

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
  
  // CAMBIO AQUÍ: Formato 12 horas con AM/PM
  horaSolicitud: new Date().toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: true 
  }),
  
  fechaSolicitud: new Date().toLocaleDateString('es-ES', { 
    day: '2-digit', 
    month: 'long' 
  }),
  estado: 'pendiente'
};

  const doc = await cuentaRef.get().toPromise();

  if (!doc?.exists) {
    // CUENTA NUEVA: Inicializamos con la notificación en true
    return cuentaRef.set({
      idMesa,
      numeroMesa,
      nombreBar,
      tokenSesion: token,
      idSesion: `SES-${Date.now()}`,
      estado: 'abierta',
      fechaApertura: new Date(),
      total: 0, // Aseguramos que el total inicial sea 0
      notificacionPendiente: true, // <--- CAMPO NUEVO
      visibilidadPreciosUsuario: false, 
      pedidos: [nuevoPedido]
    });
  } else {
    // CUENTA EXISTENTE: Anexamos pedido y ACTIVAMOS la notificación
    return cuentaRef.update({
      pedidos: firebase.firestore.FieldValue.arrayUnion(nuevoPedido),
      notificacionPendiente: true // <--- CAMPO NUEVO (Esto activa la alerta visual del admin)
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