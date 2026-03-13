import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { firstValueFrom, map } from 'rxjs';

export interface Mesa {
  id?: string;
  activa: boolean;
  numero: number;
  nombreBar: string;
  prioridadVisual?: number;
  mostrarValorCuenta?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class MesasService {

  constructor(private firestore: AngularFirestore) { }

  /**
   * Genera un ID alfanumérico corto y único.
   * Por ejemplo: F32KPWVCP6
   */
  private generarIdUnico(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = '';
    for (let i = 0; i < 10; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }

  /**
   * Obtiene todas las mesas de un bar específico, ordenadas por número.
   */
  getMesas(nombreBar: string) {
    return this.firestore.collection<Mesa>('mesas', ref => 
      ref.where('nombreBar', '==', nombreBar).orderBy('numero')
    ).snapshotChanges().pipe(
      map(actions => actions.map(a => {
        const data = a.payload.doc.data() as Mesa;
        // El ID que generamos nosotros está en el documento, no es el ID de Firestore.
        return { ...data };
      }))
    );
  }

  /**
   * Verifica si un número de mesa ya existe para un bar.
   */
  async numeroDeMesaExiste(nombreBar: string, numero: number): Promise<boolean> {
    const snapshot = await firstValueFrom(
        this.firestore.collection('mesas', ref => 
        ref.where('nombreBar', '==', nombreBar).where('numero', '==', numero).limit(1)
        ).get()
    );
    return !snapshot.empty;
  }

  /**
   * Crea una nueva mesa en la base de datos.
   */
  async crearMesa(nombreBar: string, numero: number): Promise<any> {
    const idUnico = this.generarIdUnico();
    const nuevaMesa: Mesa = {
      id: idUnico,
      activa: true,
      numero: numero,
      nombreBar: nombreBar,
      prioridadVisual: numero,
      mostrarValorCuenta: false
    };

    // Usamos el ID único que generamos como el nombre del documento.
    return this.firestore.collection('mesas').doc(idUnico).set(nuevaMesa);
  }

  /**
   * Actualiza el estado 'activa' de una mesa.
   */
  actualizarEstadoMesa(idMesa: string, nuevoEstado: boolean) {
    return this.firestore.collection('mesas').doc(idMesa).update({ activa: nuevoEstado });
  }

  actualizarPrioridadMesa(idMesa: string, prioridadVisual: number) {
    return this.firestore.collection('mesas').doc(idMesa).update({ prioridadVisual });
  }

  actualizarVisibilidadValorCuenta(idMesa: string, mostrarValorCuenta: boolean) {
    return this.firestore.collection('mesas').doc(idMesa).update({ mostrarValorCuenta });
  }
}
