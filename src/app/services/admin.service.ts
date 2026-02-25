import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  constructor(private firestore: AngularFirestore) {}

  // Mantenemos el nombre original: obtenerTokensPorRango
  obtenerTokensPorRango(nombreBar: string, inicio: Date, fin: Date) {
    // CORRECCIÓN: Normalizamos el nombre del bar para quitar espacios ("La Chula" -> "lachula")
    const barNorm = nombreBar.toLowerCase().replace(/\s+/g, '');
    
    // CORRECCIÓN: Apuntamos directamente a 'cuentas_activas' que es donde está tu data
    return this.firestore.collection('cuentas_activas', ref => 
      ref.where('nombreBar', '==', barNorm)
         .where('fechaApertura', '>=', inicio)
         .where('fechaApertura', '<=', fin)
         .orderBy('fechaApertura', 'desc')
    ).valueChanges({ idField: 'id' });
  }

  // Mantenemos el nombre original por si lo usas en otro lado
  obtenerCuentasPorToken(nombreBar: string, token: string) {
    const barNorm = nombreBar.toLowerCase().replace(/\s+/g, '');
    return this.firestore.collection('cuentas_activas', ref => 
      ref.where('nombreBar', '==', barNorm)
         .where('tokenSesion', '==', token)
    ).valueChanges({ idField: 'id' });
  }
}