import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import firebase from 'firebase/compat/app';
import { firstValueFrom, map } from 'rxjs';
import emailjs from '@emailjs/browser';

@Injectable({
  providedIn: 'root'
})
export class RockolaService {
  readonly CORREO_MASTER = 'admin@admin.com'; 

  constructor(private firestore: AngularFirestore) {}

  async validarCodigoBar(nombreBar: string, codigoCliente: string): Promise<boolean> {
    const barRef = this.firestore.collection('bares_activos').doc(nombreBar.toLowerCase().trim());
    const doc = await firstValueFrom(barRef.get());
    if (!doc.exists) return false;
    const data: any = doc.data();
    return data.codigoSeguridad.toString().trim() === codigoCliente.toString().trim();
  }

  async verificarExistenciaBar(nombreBar: string) {
    const idLimpio = nombreBar.toLowerCase().replace(/\s+/g, '');
    const doc = await firstValueFrom(this.firestore.collection('bares_activos').doc(idLimpio).get());
    return doc.exists ? doc.data() : null;
  }

  async registrarUsuarioConValidacion(datos: any, codigoIngresado?: string) {
    const nombreBusqueda = datos.nombreBar.toLowerCase().trim();
    const existeAdmin = await this.verificarSiAdminExiste(nombreBusqueda);
    let tipoAsignado = 'admin';
    let estadoInicial = true;
    if (existeAdmin) {
      const adminDoc = await firstValueFrom(this.firestore.collection('usuarios_bares', ref => ref.where('nombreBar', '==', nombreBusqueda).where('tipo', '==', 'admin')).get());
      const adminData = adminDoc.docs[0].data() as any;
      const codigoSecreto = adminData.codigoRegistroInvitados || "0000";
      if (codigoSecreto.toString() !== codigoIngresado?.toString()) throw new Error("Código incorrecto.");
      tipoAsignado = 'user';
      estadoInicial = false;
    }
    return this.firestore.collection('usuarios_bares').add({
      nombreBar: nombreBusqueda,
      correo: datos.correo.toLowerCase().trim(),
      password: datos.password,
      tipo: tipoAsignado,
      estado: estadoInicial,
      fechaHora: firebase.firestore.FieldValue.serverTimestamp(),
      codigoRegistroInvitados: tipoAsignado === 'admin' ? "1234" : "" 
    });
  }

  async actualizarCodigoDia(nombreBar: string, nuevoCodigo: string, userId: string) {
    const batch = this.firestore.firestore.batch();
    const idLimpio = nombreBar.toLowerCase().trim().replace(/\s+/g, '');
    const barRef = this.firestore.collection('bares_activos').doc(idLimpio).ref;
    batch.set(barRef, { nombreBar: nombreBar.trim(), codigoSeguridad: nuevoCodigo, ultimaActualizacion: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    const snapshot = await this.firestore.collection('solicitudes', ref => ref.where('nombreBar', '==', idLimpio).where('finalizado', '==', false)).get().toPromise();
    snapshot?.forEach(doc => batch.update(doc.ref, { finalizado: true, estado: 'expirado_por_cambio_dia' }));
    return batch.commit();
  }

  async actualizarCodigoInvitacion(userId: string, nuevoCodigoInvitacion: string) {
    return this.firestore.collection('usuarios_bares').doc(userId).update({ codigoRegistroInvitados: nuevoCodigoInvitacion });
  }

  async verificarSiAdminExiste(nombreBar: string): Promise<boolean> {
    const snapshot = await firstValueFrom(this.firestore.collection('usuarios_bares', ref => ref.where('nombreBar', '==', nombreBar.toLowerCase().trim()).where('tipo', '==', 'admin')).get());
    return !snapshot.empty;
  }

  async loginUsuario(correo: string, pass: string) {
    const snapshot = await firstValueFrom(this.firestore.collection('usuarios_bares', ref => ref.where('correo', '==', correo).where('password', '==', pass)).get());
    if (snapshot.empty) throw new Error("Credenciales incorrectas.");
    const userData = snapshot.docs[0].data() as any;
    if (userData.estado === false) throw new Error("Cuenta inactiva.");
    return { id: snapshot.docs[0].id, ...userData };
  }

  async solicitarRecuperacion(correo: string) {
    const snapshot = await firstValueFrom(this.firestore.collection('usuarios_bares', ref => ref.where('correo', '==', correo).where('estado', '==', true)).get());
    if (snapshot.empty) throw new Error("Correo no encontrado.");
    const userData = snapshot.docs[0].data() as any;
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    await this.firestore.collection('usuarios_bares').doc(snapshot.docs[0].id).update({ resetToken: token, tokenExpiracion: Date.now() + 900000 });
    try { await emailjs.send('service_h8jbhoe', 'template_9tjzw7f', { to_name: userData.nombreBar, to_email: correo, codigo_reset: token }, '0u6kiLc9fATOLPdSB'); return snapshot.docs[0].id; }
    catch { throw new Error("Error envío correo."); }
  }

  async cambiarPasswordConToken(userId: string, token: string, pass: string) {
    const doc = await firstValueFrom(this.firestore.collection('usuarios_bares').doc(userId).get());
    const data = doc.data() as any;
    if (data.resetToken === token && Date.now() < data.tokenExpiracion) { return this.firestore.collection('usuarios_bares').doc(userId).update({ password: pass, resetToken: null, tokenExpiracion: null }); }
    else throw new Error("Código inválido.");
  }

  obtenerPedidosPendientes(nombreBar: string) {
    return this.firestore.collection('solicitudes', ref => ref.where('nombreBar', '==', nombreBar.toLowerCase().trim()).where('estado', '==', 'pendiente').where('finalizado', '==', false).orderBy('fechaHora', 'asc')).snapshotChanges().pipe(map(actions => actions.map(a => ({ id: a.payload.doc.id, ...a.payload.doc.data() as any }))));
  }

  actualizarEstadoPedido(idPedido: string, nuevoEstado: string) {
    return this.firestore.collection('solicitudes').doc(idPedido).update({ estado: nuevoEstado });
  }

  obtenerMisSolicitudes(nombreBar: string, idMesaTecnico: string) {
    return this.firestore.collection('solicitudes', ref => 
      ref.where('nombreBar', '==', nombreBar.toLowerCase().trim())
         .where('mesaCodigo', '==', idMesaTecnico)
         .where('finalizado', '==', false)
    ).snapshotChanges().pipe(
      map(actions => actions.map(a => ({ id: a.payload.doc.id, ...a.payload.doc.data() as any })))
    );
  }

  async obtenerDatosMesa(idDocumento: string) {
    try { const doc = await firstValueFrom(this.firestore.collection('mesas').doc(idDocumento).get()); return doc.exists ? doc.data() as any : null; }
    catch { return null; }
  }

  async enviarSolicitud(track: any, nombreBar: string, idMesaTecnico: string, numeroMesaVisible: string | number) {
    const docRef = await this.firestore.collection('solicitudes').add({
      spotifyId: track.id,
      artista: track.artists[0].name,
      cancion: track.name,
      foto: track.album.images[0]?.url,
      nombreBar: nombreBar.toLowerCase().trim(),
      mesaCodigo: idMesaTecnico,
      mesaNumero: numeroMesaVisible,
      dia: new Date().toISOString().split('T')[0], 
      fechaHora: firebase.firestore.FieldValue.serverTimestamp(),
      estado: "pendiente",
      finalizado: false,
      uri: track.uri 
    });
    return docRef.id;
  }

  async eliminarSolicitud(nombreBar: string, idSolicitud: string) {
    return this.firestore.collection('solicitudes').doc(idSolicitud).delete();
  }
}
