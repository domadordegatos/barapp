import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  constructor(private firestore: AngularFirestore) {}

  actualizarCuenta(idDoc: string, data: any) {
    return this.firestore.collection('cuentas_activas').doc(idDoc).update(data);
  }

  // NUEVO: Finalizar cuenta moviéndola a otra colección
  async archivarCuenta(cuenta: any) {
    const idCuenta = cuenta.id;
    // 1. Guardamos una copia en 'facturas_finalizadas'
    await this.firestore.collection('facturas_finalizadas').doc(idCuenta + '_' + Date.now()).set({
      ...cuenta,
      fechaArchivo: new Date()
    });
    // 2. La borramos de 'cuentas_activas'
    return this.firestore.collection('cuentas_activas').doc(idCuenta).delete();
  }

  obtenerCuentasActivas(nombreBar: string) {
    const barNorm = nombreBar.toLowerCase().replace(/\s+/g, '');
    return this.firestore.collection('cuentas_activas', ref => 
      ref.where('nombreBar', '==', barNorm)
         .where('estado', '==', 'abierta')
    ).valueChanges({ idField: 'id' });
  }

  obtenerTokensPorRango(nombreBar: string, inicio: Date, fin: Date) {
    const barNorm = nombreBar.toLowerCase().replace(/\s+/g, '');
    return this.firestore.collection('cuentas_activas', ref => 
      ref.where('nombreBar', '==', barNorm)
         .where('fechaApertura', '>=', inicio)
         .where('fechaApertura', '<=', fin)
         .orderBy('fechaApertura', 'desc')
    ).valueChanges({ idField: 'id' });
  }

  obtenerFacturasFinalizadasPorRango(nombreBar: string, inicio: Date, fin: Date) {
    const barNorm = nombreBar.toLowerCase().replace(/\s+/g, '');
    return this.firestore.collection('facturas_finalizadas', ref =>
      ref.where('nombreBar', '==', barNorm)
    ).valueChanges({ idField: 'id' });
  }

  actualizarFacturaFinalizada(idDoc: string, data: any) {
    return this.firestore.collection('facturas_finalizadas').doc(idDoc).update(data);
  }
}
