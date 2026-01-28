import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import firebase from 'firebase/compat/app';
import { firstValueFrom } from 'rxjs';
import { Track } from '../buscar-canciones/buscar-canciones.component';

@Injectable({
  providedIn: 'root'
})
export class RockolaService {
  constructor(private firestore: AngularFirestore) {}

  obtenerMisSolicitudes(codigoMesa: string) {
    return this.firestore.collection('solicitudes', ref => 
      ref.where('mesaCodigo', '==', codigoMesa)
         .where('finalizado', '==', false) // Solo sesiones activas
         .orderBy('fechaHora', 'desc')     // La última pedida primero
    ).valueChanges();
  }

  // CORREGIDO: Busca el documento directamente por su ID
  async obtenerDatosMesa(idDocumento: string): Promise<{ numero: number, activa: boolean } | null> {
    try {
      // Accedemos directamente al documento en la colección 'mesas'
      const doc = await firstValueFrom(
        this.firestore.collection('mesas').doc(idDocumento).get()
      );

      if (doc.exists) {
        const data = doc.data() as any;
        return {
          numero: data.numero, // El campo 'numero' tipo number
          activa: data.activa   // El campo 'activa' tipo boolean
        };
      }
      return null; // Si el documento no existe
    } catch (error) {
      console.error("Error al obtener mesa:", error);
      return null;
    }
  }

  async enviarSolicitud(track: Track, codigoMesa: string, numeroMesa: number) {
    return this.firestore.collection('solicitudes').add({
      spotifyId: track.id,
      artista: track.artists[0].name,
      cancion: track.name,
      foto: track.album.images[0]?.url,
      dia: new Date().toISOString().split('T')[0],
      estado: "pendiente",
      finalizado: false,
      fechaHora: firebase.firestore.FieldValue.serverTimestamp(),
      mesaCodigo: codigoMesa, // El ID del documento (F32KPWVCP6)
      mesaNumero: numeroMesa  // El número real (1)
    });
  }
}