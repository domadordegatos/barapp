// ventas.service.ts
import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import firebase from 'firebase/compat/app';

@Injectable({
  providedIn: 'root'
})
export class VentasService {

  constructor(private firestore: AngularFirestore) {}
// Obtener las categorías de un bar específico
obtenerCategorias(nombreBarLimpio: string) {
  return this.firestore.collection('categorias_bares', ref => 
    ref.where('nombreBar', '==', nombreBarLimpio)
  ).valueChanges({ idField: 'id' });
}

// Agregar una nueva categoría
async agregarCategoria(nombreBarLimpio: string, nombreCategoria: string) {
  return this.firestore.collection('categorias_bares').add({
    nombreBar: nombreBarLimpio,
    nombre: nombreCategoria,
    fechaCreacion: new Date()
  });
}

// Eliminar categoría
async eliminarCategoria(id: string) {
  return this.firestore.collection('categorias_bares').doc(id).delete();
}
  // --- GESTIÓN DE CATEGORÍAS ---

  async actualizarCategorias(nombreBarLimpio: string, categorias: string[]) {
    return this.firestore.collection('categorias_bar').doc(nombreBarLimpio).set({
      nombreBar: nombreBarLimpio,
      lista: categorias,
      ultimaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  // --- GESTIÓN DE PRODUCTOS ---

  // ventas.service.ts

// Cambiar visibilidad de la categoría
async cambiarEstadoCategoria(id: string, nuevoEstado: boolean) {
  return this.firestore.collection('categorias_bares').doc(id).update({
    activo: nuevoEstado
  });
}

  // Agregar un producto nuevo
  async agregarProducto(nombreBarLimpio: string, producto: any) {
    return this.firestore.collection('productos').add({
      ...producto,
      nombreBar: nombreBarLimpio,
      fechaCreacion: firebase.firestore.FieldValue.serverTimestamp(),
      disponible: true
    });
  }

  // Obtener todos los productos de un bar específico
  obtenerProductos(nombreBarLimpio: string) {
    return this.firestore.collection('productos', ref => 
      ref.where('nombreBar', '==', nombreBarLimpio)
         .orderBy('categoria', 'asc')
         .orderBy('nombre', 'asc')
    ).valueChanges({ idField: 'id' });
  }

  // Actualizar un producto (precio, stock, etc.)
  async actualizarProducto(idProducto: string, datos: any) {
    return this.firestore.collection('productos').doc(idProducto).update(datos);
  }

  // Eliminar producto
  async eliminarProducto(idProducto: string) {
    return this.firestore.collection('productos').doc(idProducto).delete();
  }
}