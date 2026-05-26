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

  async parcharOperadorIds(nombreBar: string): Promise<{ actualizados: number; pedidosActualizados: number }> {
    const barNorm = nombreBar.toLowerCase().replace(/\s+/g, '');

    const usuariosSnap = await this.firestore.collection('usuarios_bares').ref
      .where('nombreBar', '==', barNorm).get();

    const mapNombre = new Map<string, string>();
    const mapCorreo = new Map<string, string>();

    usuariosSnap.docs.forEach(doc => {
      const data = doc.data() as any;
      const nombre = String(data?.nombreUsuarioBar || '').toLowerCase().trim();
      const correo = String(data?.correo || '').toLowerCase().trim();
      if (nombre) mapNombre.set(nombre, doc.id);
      if (correo) mapCorreo.set(correo, doc.id);
    });

    let actualizados = 0;
    let pedidosActualizados = 0;

    for (const col of ['cuentas_activas', 'facturas_finalizadas']) {
      const snap = await this.firestore.collection(col).ref
        .where('nombreBar', '==', barNorm).get();

      const updates: Promise<any>[] = [];

      for (const docSnap of snap.docs) {
        const data = docSnap.data() as any;
        const pedidos = Array.isArray(data?.pedidos) ? data.pedidos.map((p: any) => ({ ...p })) : [];
        let modified = false;

        for (const pedido of pedidos) {
          if (!pedido.operadorId && pedido.operador) {
            const key = String(pedido.operador).toLowerCase().trim();
            const id = mapNombre.get(key) || mapCorreo.get(key);
            if (id) {
              pedido.operadorId = id;
              modified = true;
              pedidosActualizados++;
            }
          }
        }

        if (modified) {
          updates.push(docSnap.ref.update({ pedidos }));
          actualizados++;
        }
      }

      await Promise.all(updates);
    }

    return { actualizados, pedidosActualizados };
  }
}
