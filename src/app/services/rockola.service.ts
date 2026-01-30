import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import firebase from 'firebase/compat/app';
import { firstValueFrom, map } from 'rxjs';
import { Track } from '../buscar-canciones/buscar-canciones.component';
import emailjs from '@emailjs/browser';

@Injectable({
  providedIn: 'root'
})
export class RockolaService {
  constructor(private firestore: AngularFirestore) {}

// rockola.service.ts

// 1. Verificar si el bar ya tiene un administrador y está en bares_activos
async verificarExistenciaBar(nombreBar: string) {
  const doc = await firstValueFrom(
    this.firestore.collection('bares_activos').doc(nombreBar.toLowerCase().trim()).get()
  );
  return doc.exists ? doc.data() : null;
}

// 2. Registro con validación de código para empleados
async registrarUsuarioConValidacion(datos: any, codigoIngresado?: string) {
  const nombreLimpio = datos.nombreBar.toLowerCase().trim();
  const barActivo: any = await this.verificarExistenciaBar(nombreLimpio);

  let tipoAsignado = 'admin';

  if (barActivo) {
    // Si el bar existe, validamos el código del día
    if (barActivo.codigoSeguridad !== codigoIngresado) {
      throw new Error("El código del bar es incorrecto. Pídelo al administrador.");
    }
    tipoAsignado = 'user'; // Es empleado porque el bar ya existía
  }

  // Registramos en usuarios_bares
  return this.firestore.collection('usuarios_bares').add({
    ...datos,
    nombreBar: nombreLimpio,
    tipo: tipoAsignado,
    estado: false, // Sigue requiriendo tu activación manual en BD
    fechaHora: firebase.firestore.FieldValue.serverTimestamp(),
    codigo: barActivo ? barActivo.codigoSeguridad : "" // Hereda el código si es empleado
  });
}
actualizarCodigoDia(nombreBar: string, nuevoCodigo: string, userId: string) {
  const batch = this.firestore.firestore.batch();

  // 1. Referencia al usuario en 'usuarios_bares'
  const userRef = this.firestore.collection('usuarios_bares').doc(userId).ref;
  batch.update(userRef, { codigo: nuevoCodigo });

  // 2. Referencia en la nueva colección 'bares_activos'
  // Usamos el nombre del bar como ID del documento para que sea único y fácil de buscar
  const barRef = this.firestore.collection('bares_activos').doc(nombreBar.toLowerCase()).ref;
  
  batch.set(barRef, {
    nombreBar: nombreBar,
    codigoSeguridad: nuevoCodigo,
    ultimaActualizacion: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  return batch.commit();
}
// Método para Login Manual
async loginUsuario(correo: string, pass: string) {
  const userRef = this.firestore.collection('usuarios_bares', ref => 
    ref.where('correo', '==', correo).where('password', '==', pass)
  );

  const snapshot = await firstValueFrom(userRef.get());

  if (snapshot.empty) {
    throw new Error("Credenciales incorrectas.");
  }

  const userData = snapshot.docs[0].data() as any;
  const userId = snapshot.docs[0].id;

  // VALIDACIÓN DE ESTADO
  if (userData.estado === false) {
    throw new Error("Tu cuenta no se encuentra activa. Contacta al soporte técnico.");
  }

  return { id: userId, ...userData };
}

async solicitarRecuperacion(correo: string) {
  const userRef = this.firestore.collection('usuarios_bares', ref => 
    ref.where('correo', '==', correo).where('estado', '==', true)
  );
  
  const snapshot = await firstValueFrom(userRef.get());
  if (snapshot.empty) throw new Error("Correo no encontrado o cuenta inactiva.");

  const userData = snapshot.docs[0].data() as any;
  const userId = snapshot.docs[0].id;
  const token = Math.floor(100000 + Math.random() * 900000).toString();

  // 1. Guardar token en BD (Invisible para el atacante)
  await this.firestore.collection('usuarios_bares').doc(userId).update({
    resetToken: token,
    tokenExpiracion: Date.now() + 900000 
  });

  // 2. ENVÍO REAL POR CORREO
  const templateParams = {
    to_name: userData.nombreBar,
    to_email: correo,
    codigo_reset: token // Este es el que pusiste en la plantilla de EmailJS
  };

  try {
    await emailjs.send(
      'service_h8jbhoe', 
      'template_9tjzw7f', 
      templateParams, 
      '0u6kiLc9fATOLPdSB'
    );
    return userId;
  } catch (error) {
    console.error("Error al enviar correo:", error);
    throw new Error("No se pudo enviar el correo de recuperación.");
  }
}

async cambiarPasswordConToken(userId: string, tokenRecibido: string, nuevaPass: string) {
  const doc = await firstValueFrom(this.firestore.collection('usuarios_bares').doc(userId).get());
  const data = doc.data() as any;

  if (data.resetToken === tokenRecibido && Date.now() < data.tokenExpiracion) {
    return this.firestore.collection('usuarios_bares').doc(userId).update({
      password: nuevaPass,
      resetToken: null, // Limpiamos el token usado
      tokenExpiracion: null
    });
  } else {
    throw new Error("El código es incorrecto o ya expiró.");
  }
}

async registrarNuevoUsuario(datos: any) {
  const baresRef = this.firestore.collection('usuarios_bares', ref => 
    ref.where('nombreBar', '==', datos.nombreBar.toLowerCase().trim())
  );
  
  const snapshot = await firstValueFrom(baresRef.get());
  let tipoUsuario = 'admin';

  // Si ya existe el bar, pedimos el código (más adelante validaremos el código real)
  if (!snapshot.empty) {
    const codigoIngresado = prompt("Este bar ya está registrado. Ingresa el código de 4 dígitos del administrador:");
    if (!codigoIngresado) throw new Error("Código requerido");
    
    // Por ahora, como el código en BD está vacío, cualquier código permite el registro como 'user'
    tipoUsuario = 'user';
  }

  return this.firestore.collection('usuarios_bares').add({
    nombreBar: datos.nombreBar.toLowerCase().trim(),
    correo: datos.correo,
    password: datos.password, // Nota: En producción, esto debería ir cifrado con Firebase Auth
    fechaHora: firebase.firestore.FieldValue.serverTimestamp(),
    estado: false,
    codigo: "", // Se asignará manualmente después
    tipo: tipoUsuario
  });
}

obtenerPedidosPendientes() {
  return this.firestore.collection('solicitudes', ref => 
    ref.where('estado', '==', 'pendiente')
       .where('finalizado', '==', false) // Solo de la sesión actual
       .orderBy('fechaHora', 'asc')      // Prioridad a la más antigua
  ).snapshotChanges().pipe(
    map(actions => actions.map(a => {
      const data = a.payload.doc.data() as any;
      const id = a.payload.doc.id;
      return { id, ...data };
    }))
  );
}

actualizarEstadoPedido(idPedido: string, nuevoEstado: string) {
  // Al cambiar el estado, desaparecerá de la vista gracias al filtro 'pendiente'
  return this.firestore.collection('solicitudes').doc(idPedido).update({
    estado: nuevoEstado
  });
}

// rockola.service.ts
obtenerMisSolicitudes(codigoMesa: string) {
  return this.firestore.collection('solicitudes', ref => 
    ref.where('mesaCodigo', '==', codigoMesa)
       .where('finalizado', '==', false)
       .orderBy('fechaHora', 'asc') // CAMBIO: 'asc' para que la primera sea la #1
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