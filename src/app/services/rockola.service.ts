import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import firebase from 'firebase/compat/app';
import { firstValueFrom, map } from 'rxjs';
import { Track } from '../music/buscar-canciones/buscar-canciones.component';
import emailjs from '@emailjs/browser';

@Injectable({
  providedIn: 'root'
})
export class RockolaService {

  readonly CORREO_MASTER = 'admin@admin.com'; // Sustituye por el tuyo
  constructor(private firestore: AngularFirestore) {}

// rockola.service.ts

// rockola.service.ts

async validarCodigoBar(nombreBar: string, codigoCliente: string): Promise<boolean> {
  const barRef = this.firestore.collection('bares_activos').doc(nombreBar.toLowerCase().trim());
  const doc = await firstValueFrom(barRef.get());

  if (!doc.exists) return false;

  const data: any = doc.data();
  
  // Convertimos AMBOS a string y quitamos espacios por si acaso
  const codigoBD = data.codigoSeguridad.toString().trim();
  const codigoUser = codigoCliente.toString().trim();

  return codigoBD === codigoUser;
}

// rockola.service.ts

async verificarExistenciaBar(nombreBar: string) {
  // Siempre buscamos el ID del documento en minúsculas y sin espacios
  const idLimpio = nombreBar.toLowerCase().replace(/\s+/g, '');
  const doc = await firstValueFrom(
    this.firestore.collection('bares_activos').doc(idLimpio).get()
  );
  return doc.exists ? doc.data() : null;
}

// 2. Registro con validación de código para empleados
// Lógica de registro inteligente
async registrarUsuarioConValidacion(datos: any, codigoIngresado?: string) {
  const nombreBusqueda = datos.nombreBar.toLowerCase().trim();
  const existeAdmin = await this.verificarSiAdminExiste(nombreBusqueda);

  let tipoAsignado = 'admin';
  let estadoInicial = true; // El primer admin se activa (puedes cambiarlo a false si prefieres)

  if (existeAdmin) {
    // Si ya existe admin, validamos el código para crear un 'user'
    const adminDoc = await firstValueFrom(
      this.firestore.collection('usuarios_bares', ref => 
        ref.where('nombreBar', '==', nombreBusqueda).where('tipo', '==', 'admin')
      ).get()
    );
    
    const adminData = adminDoc.docs[0].data() as any;
    const codigoSecreto = adminData.codigoRegistroInvitados || "0000";

    if (codigoSecreto.toString() !== codigoIngresado?.toString()) {
      throw new Error("El código de autorización para empleados es incorrecto.");
    }
    
    tipoAsignado = 'user';
    estadoInicial = false; // Los empleados siempre requieren activación
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

// Esta función ahora crea el bar en 'bares_activos' si no existe
async actualizarCodigoDia(nombreBar: string, nuevoCodigo: string, userId: string) {
  const batch = this.firestore.firestore.batch();
  
  // ID Limpio para la base de datos (sin espacios): "lachula"
  const idLimpio = nombreBar.toLowerCase().trim().replace(/\s+/g, '');
  
  // Nombre Real para mostrar: "La Chula"
  const nombreReal = nombreBar.trim();

  const barRef = this.firestore.collection('bares_activos').doc(idLimpio).ref;
  
  // Usamos 'set' con { merge: true } para que si no existe lo cree, 
  // y si existe solo actualice el código y la fecha.
  batch.set(barRef, { 
    nombreBar: nombreReal,
    codigoSeguridad: nuevoCodigo, 
    ultimaActualizacion: firebase.firestore.FieldValue.serverTimestamp() 
  }, { merge: true });

  // Limpiar pedidos antiguos si existen
  const snapshot = await this.firestore.collection('solicitudes', ref => 
    ref.where('nombreBar', '==', idLimpio).where('finalizado', '==', false)
  ).get().toPromise();

  snapshot?.forEach(doc => {
    batch.update(doc.ref, { finalizado: true, estado: 'expirado_por_cambio_dia' });
  });

  return batch.commit();
}

// NUEVA FUNCIÓN: Solo para el código de invitación (empleados)
async actualizarCodigoInvitacion(userId: string, nuevoCodigoInvitacion: string) {
  return this.firestore.collection('usuarios_bares').doc(userId).update({
    codigoRegistroInvitados: nuevoCodigoInvitacion
  });
}

// Función para el componente de registro
async verificarSiAdminExiste(nombreBar: string): Promise<boolean> {
  const nombreBusqueda = nombreBar.toLowerCase().trim();
  const snapshot = await firstValueFrom(
    this.firestore.collection('usuarios_bares', ref => 
      ref.where('nombreBar', '==', nombreBusqueda)
         .where('tipo', '==', 'admin')
    ).get()
  );
  return !snapshot.empty;
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

// rockola.service.ts

// rockola.service.ts

obtenerPedidosPendientes(nombreBar: string) {
  // Normalizamos el nombre para asegurar la coincidencia con la BD
  const nombreLimpio = nombreBar.toLowerCase().trim().replace(/\s+/g, '');

  return this.firestore.collection('solicitudes', ref => 
    ref.where('nombreBar', '==', nombreLimpio)
       .where('finalizado', '==', false) // Trae todo lo activo
       .orderBy('fechaHora', 'asc')
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

obtenerMisSolicitudes(nombreBar: string, idMesaTecnico: string) {
  return this.firestore.collection('solicitudes', ref => 
    ref.where('nombreBar', '==', nombreBar.toLowerCase().trim())
       .where('mesaCodigo', '==', idMesaTecnico) // Filtramos por el código de la URL
       .where('finalizado', '==', false)
       .orderBy('fechaHora', 'asc')
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

// rockola.service.ts

// 1. Guardamos AMBOS datos en la solicitud
async enviarSolicitud(track: any, nombreBar: string, idMesaTecnico: string, numeroMesaVisible: string | number) {
  return this.firestore.collection('solicitudes').add({
    spotifyId: track.id,
    artista: track.artists[0].name,
    cancion: track.name,
    foto: track.album.images[0]?.url,
    nombreBar: nombreBar.toLowerCase().trim(),
    
    // LA CLAVE: Guardamos el ID para el cliente y el Numero para el admin
    mesaCodigo: idMesaTecnico,       // Ejemplo: "F32KPWVCP6" (Para el cliente)
    mesaNumero: numeroMesaVisible,   // Ejemplo: 1 (Para el admin)
    
    dia: new Date().toISOString().split('T')[0], 
    fechaHora: firebase.firestore.FieldValue.serverTimestamp(),
    estado: "pendiente",
    finalizado: false,
    uri: track.uri 
  });
}


}