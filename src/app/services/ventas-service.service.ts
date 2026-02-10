// ventas.service.ts
import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import firebase from 'firebase/compat/app';

@Injectable({
  providedIn: 'root'
})
export class VentasService {

  constructor(private firestore: AngularFirestore) {}

  // --- GESTIÓN DE CATEGORÍAS ---

  // Obtiene o crea el documento de categorías para un bar
  obtenerCategorias(nombreBarLimpio: string) {
    return this.firestore.collection('categorias_bar').doc(nombreBarLimpio).valueChanges();
  }

  async actualizarCategorias(nombreBarLimpio: string, categorias: string[]) {
    return this.firestore.collection('categorias_bar').doc(nombreBarLimpio).set({
      nombreBar: nombreBarLimpio,
      lista: categorias,
      ultimaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  // --- GESTIÓN DE PRODUCTOS ---

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