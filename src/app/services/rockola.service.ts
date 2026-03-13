import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import firebase from 'firebase/compat/app';
import { firstValueFrom, map, Observable } from 'rxjs';
import emailjs from '@emailjs/browser';
import { SolicitudCancion } from '../interfaces/producto.interface';

@Injectable({
  providedIn: 'root'
})
export class RockolaService {
  readonly CORREO_MASTER = 'admin@admin.com'; 

  constructor(private firestore: AngularFirestore) {}

  private normalizarNombreBar(nombreBar: string): string {
    return nombreBar.toLowerCase().trim().replace(/\s+/g, '');
  }

  private esNombreVisibleValido(nombreBar: string | undefined | null): boolean {
    return typeof nombreBar === 'string' && nombreBar.trim().length > 0;
  }

  private async resolverNombreVisibleBar(nombreBar: string, nombreBarVisible?: string, dataActual?: Record<string, any>): Promise<string> {
    if (this.esNombreVisibleValido(nombreBarVisible)) {
      return nombreBarVisible!.trim();
    }

    if (this.esNombreVisibleValido(dataActual?.['nombreBarVisible'])) {
      return String(dataActual?.['nombreBarVisible']).trim();
    }

    if (this.esNombreVisibleValido(dataActual?.['nombreBar'])) {
      const nombreActual = String(dataActual?.['nombreBar']).trim();
      const nombreNormalizado = this.normalizarNombreBar(nombreActual);

      if (nombreActual.includes(' ') || nombreNormalizado !== nombreActual) {
        return nombreActual;
      }
    }

    const nombreRecuperado = await this.recuperarNombreVisibleDesdeUsuarios(nombreBar);
    if (this.esNombreVisibleValido(nombreRecuperado)) {
      return nombreRecuperado!;
    }

    return nombreBar.trim();
  }

  private async recuperarNombreVisibleDesdeUsuarios(nombreBar: string): Promise<string | null> {
    const idLimpio = this.normalizarNombreBar(nombreBar);
    const snapshot = await firstValueFrom(
      this.firestore.collection('usuarios_bares', ref => ref.where('tipo', '==', 'admin')).get()
    );

    const adminCoincidente = snapshot.docs
      .map(doc => doc.data() as any)
      .find(usuario => this.normalizarNombreBar(usuario?.nombreBar || '') === idLimpio);

    const nombreVisible = adminCoincidente?.nombreBar;
    return this.esNombreVisibleValido(nombreVisible) ? nombreVisible.trim() : null;
  }

  // ... (métodos existentes)

  /**
   * Obtiene todas las solicitudes de canciones para un bar específico, ordenadas por fecha.
   * @param nombreBar El identificador del bar.
   * @returns Un observable con la lista de solicitudes.
   */
  getSolicitudesPorBar(nombreBar: string): Observable<SolicitudCancion[]> {
    const idLimpio = this.normalizarNombreBar(nombreBar);
    return this.firestore.collection<SolicitudCancion>(
      `bares_activos/${idLimpio}/solicitudes`,
      ref => ref.orderBy('fechaHora', 'desc')
    ).snapshotChanges().pipe(
      map(actions => actions.map(a => {
        const data = a.payload.doc.data() as SolicitudCancion;
        const id = a.payload.doc.id;
        return { id, ...data };
      }))
    );
  }

  /**
   * Actualiza el estado de una solicitud de canción específica.
   * @param nombreBar El identificador del bar.
   * @param idSolicitud El ID de la solicitud a actualizar.
   * @param nuevoEstado El nuevo estado a asignar.
   */
  actualizarEstadoSolicitud(nombreBar: string, idSolicitud: string, nuevoEstado: string): Promise<void> {
    const idLimpio = this.normalizarNombreBar(nombreBar);
    const solicitudRef = this.firestore.doc(`bares_activos/${idLimpio}/solicitudes/${idSolicitud}`);
    return solicitudRef.update({ estado: nuevoEstado });
  }

  observarBar(nombreBar: string): Observable<any | null> {
    const idLimpio = this.normalizarNombreBar(nombreBar);
    return this.firestore.collection('bares_activos').doc(idLimpio).valueChanges().pipe(
      map((bar: any) => bar ? { servicioHabilitado: true, nombreBarVisible: bar.nombreBarVisible || bar.nombreBar || '', ...bar } : null)
    );
  }

  async actualizarEstadoServicio(nombreBar: string, servicioHabilitado: boolean, nombreBarVisible?: string): Promise<void> {
    const idLimpio = this.normalizarNombreBar(nombreBar);
    const barDoc = await firstValueFrom(this.firestore.collection('bares_activos').doc(idLimpio).get());
    const dataActual = (barDoc.data() || {}) as Record<string, any>;
    const nombreVisibleResuelto = await this.resolverNombreVisibleBar(nombreBar, nombreBarVisible, dataActual);

    return this.firestore.collection('bares_activos').doc(idLimpio).set({
      nombreBar: nombreVisibleResuelto,
      nombreBarVisible: nombreVisibleResuelto,
      servicioHabilitado
    }, { merge: true });
  }

  async validarCodigoBar(nombreBar: string, codigoCliente: string): Promise<boolean> {
    const barRef = this.firestore.collection('bares_activos').doc(this.normalizarNombreBar(nombreBar));
    const doc = await firstValueFrom(barRef.get());
    if (!doc.exists) return false;
    const data: any = doc.data();
    return data.codigoSeguridad.toString().trim() === codigoCliente.toString().trim();
  }

  async verificarExistenciaBar(nombreBar: string) {
    const idLimpio = this.normalizarNombreBar(nombreBar);
    const doc = await firstValueFrom(this.firestore.collection('bares_activos').doc(idLimpio).get());
    if (!doc.exists) {
      return null;
    }

    const data = (doc.data() || {}) as Record<string, any>;
    const nombreVisibleResuelto = await this.resolverNombreVisibleBar(nombreBar, data['nombreBarVisible'] as string | undefined, data);
    return { servicioHabilitado: true, ...data, nombreBar: nombreVisibleResuelto, nombreBarVisible: nombreVisibleResuelto };
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

  async actualizarCodigoDia(nombreBar: string, nuevoCodigo: string, userId: string, nombreBarVisible?: string) {
    const batch = this.firestore.firestore.batch();
    const idLimpio = this.normalizarNombreBar(nombreBar);
    const barRef = this.firestore.collection('bares_activos').doc(idLimpio).ref;
    const barDoc = await firstValueFrom(this.firestore.collection('bares_activos').doc(idLimpio).get());
    const dataActual = (barDoc.data() || {}) as Record<string, any>;
    const nombreVisibleResuelto = await this.resolverNombreVisibleBar(nombreBar, nombreBarVisible, dataActual);
    batch.set(barRef, { nombreBar: nombreVisibleResuelto, nombreBarVisible: nombreVisibleResuelto, codigoSeguridad: nuevoCodigo, ultimaActualizacion: firebase.firestore.FieldValue.serverTimestamp(), servicioHabilitado: true }, { merge: true });
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
    return this.firestore.collection('solicitudes', ref => ref.where('nombreBar', '==', this.normalizarNombreBar(nombreBar)).where('estado', '==', 'pendiente').where('finalizado', '==', false).orderBy('fechaHora', 'asc')).snapshotChanges().pipe(map(actions => actions.map(a => ({ id: a.payload.doc.id, ...a.payload.doc.data() as any }))));
  }

  actualizarEstadoPedido(idPedido: string, nuevoEstado: string) {
    return this.firestore.collection('solicitudes').doc(idPedido).update({ estado: nuevoEstado });
  }

  obtenerMisSolicitudes(nombreBar: string, idMesaTecnico: string) {
    return this.firestore.collection('solicitudes', ref => 
      ref.where('nombreBar', '==', this.normalizarNombreBar(nombreBar))
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

  async obtenerMesaValidaDelBar(idDocumento: string, nombreBar: string) {
    try {
      const doc = await firstValueFrom(this.firestore.collection('mesas').doc(idDocumento).get());
      if (!doc.exists) {
        return null;
      }

      const data = doc.data() as any;
      const barNormalizado = this.normalizarNombreBar(nombreBar);
      const nombreBarMesa = this.normalizarNombreBar(data?.nombreBar || '');

      if (nombreBarMesa !== barNormalizado || data?.activa !== true) {
        return null;
      }

      return data;
    } catch {
      return null;
    }
  }

  observarMesa(idDocumento: string): Observable<any | null> {
    return this.firestore.collection('mesas').doc(idDocumento).valueChanges().pipe(
      map(mesa => mesa || null)
    );
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
