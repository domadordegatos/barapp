import { Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { Subscription } from 'rxjs';
import { NotificationService } from '../../services/notification.service';
import { RockolaService } from '../../services/rockola.service';

interface UsuarioBarView {
  id: string;
  correo: string;
  tipo: string;
  nombreUsuarioBar: string;
  estado: boolean;
  estadoBarActivo: boolean;
  fechaHora?: any;
}

@Component({
  selector: 'app-gestion-usuarios-bar',
  templateUrl: './gestion-usuarios-bar.component.html',
  styleUrls: ['./gestion-usuarios-bar.component.scss']
})
export class GestionUsuariosBarComponent implements OnChanges, OnDestroy {
  @Input() nombreBar: string = '';
  @Input() esAdmin: boolean = false;

  cargandoUsuarios: boolean = false;
  guardandoId: string = '';
  filtroCorreo: string = '';
  usuarios: UsuarioBarView[] = [];
  correoSesion: string = '';

  // Dar de baja
  confirmarEliminarId: string = '';
  eliminandoId: string = '';

  // Crear usuario
  mostrandoFormCrear: boolean = false;
  mostrandoModalPendiente: boolean = false;
  creandoUsuario: boolean = false;
  nuevoCorreo: string = '';
  nuevoPassword: string = '';
  nuevoNombreAsignado: string = '';
  errorCrearForm: string = '';

  private usuariosSubscription: Subscription | null = null;

  constructor(
    private rockolaService: RockolaService,
    private notificationService: NotificationService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['nombreBar'] || changes['esAdmin']) && this.esAdmin && this.nombreBar) {
      try {
        const sesion = JSON.parse(localStorage.getItem('usuarioAdmin') || '{}');
        this.correoSesion = String(sesion?.correo || '').toLowerCase().trim();
      } catch (_) {
        this.correoSesion = '';
      }
      this.cargarUsuarios();
    }
  }

  ngOnDestroy(): void {
    if (this.usuariosSubscription) {
      this.usuariosSubscription.unsubscribe();
    }
  }

  get usuariosFiltrados(): UsuarioBarView[] {
    const termino = String(this.filtroCorreo || '').toLowerCase().trim();

    if (!termino) {
      return this.usuarios;
    }

    return this.usuarios.filter((u) => String(u?.correo || '').toLowerCase().includes(termino));
  }

  cargarUsuarios(): void {
    if (!this.nombreBar || !this.esAdmin) {
      return;
    }

    this.cargandoUsuarios = true;

    if (this.usuariosSubscription) {
      this.usuariosSubscription.unsubscribe();
    }

    this.usuariosSubscription = this.rockolaService.obtenerUsuariosPorBar(this.nombreBar).subscribe({
      next: (lista: any[]) => {
        this.usuarios = (lista || [])
          .map((u: any) => ({
            id: String(u?.id || ''),
            correo: String(u?.correo || ''),
            tipo: String(u?.tipo || 'user'),
            nombreUsuarioBar: String(u?.nombreUsuarioBar || ''),
            estado: u?.estado === true,
            estadoBarActivo: u?.estadoBarActivo !== false,
            fechaHora: u?.fechaHora
          }))
          .sort((a, b) => {
            if (a.tipo === 'admin' && b.tipo !== 'admin') return -1;
            if (a.tipo !== 'admin' && b.tipo === 'admin') return 1;
            return a.correo.localeCompare(b.correo, 'es');
          });

        this.cargandoUsuarios = false;
      },
      error: (error) => {
        console.error(error);
        this.cargandoUsuarios = false;
        this.notificationService.error('No se pudo cargar la lista de usuarios del bar.');
      }
    });
  }

  esPropioAdmin(usuario: UsuarioBarView): boolean {
    return usuario.tipo === 'admin' && usuario.correo.toLowerCase().trim() === this.correoSesion;
  }

  alternarEstadoBarLocal(usuario: UsuarioBarView): void {
    if (this.esPropioAdmin(usuario)) {
      this.notificationService.warning('No puedes desactivarte a ti mismo desde este panel.');
      return;
    }

    if (usuario.estado !== true) {
      this.notificationService.warning('Este usuario aun no esta aprobado por Super Admin.');
      return;
    }

    usuario.estadoBarActivo = !usuario.estadoBarActivo;
  }

  iniciarEliminar(usuario: UsuarioBarView): void {
    this.confirmarEliminarId = usuario.id;
  }

  cancelarEliminar(): void {
    this.confirmarEliminarId = '';
  }

  async confirmarEliminar(usuario: UsuarioBarView): Promise<void> {
    try {
      this.eliminandoId = usuario.id;
      await this.rockolaService.eliminarUsuarioDeBar(usuario.id);
      this.confirmarEliminarId = '';
      this.notificationService.success('Usuario dado de baja. Ya no aparecera en el listado.');
    } catch (error) {
      console.error(error);
      this.notificationService.error('No se pudo dar de baja al usuario.');
    } finally {
      this.eliminandoId = '';
    }
  }

  async guardarEstadoUsuarioBar(usuario: UsuarioBarView): Promise<void> {
    if (!usuario?.id) {
      return;
    }

    const nombreAjustado = String(usuario.nombreUsuarioBar || '').trim();

    if (!nombreAjustado) {
      this.notificationService.warning('Debes asignar un nombre al usuario para guardarlo.');
      return;
    }

    try {
      this.guardandoId = usuario.id;
      await this.rockolaService.actualizarEstadoUsuarioBar(usuario.id, usuario.estadoBarActivo, nombreAjustado);
      usuario.nombreUsuarioBar = nombreAjustado;
      this.notificationService.success(usuario.estadoBarActivo ? 'Usuario habilitado para operar en el bar.' : 'Usuario deshabilitado para operar en el bar.');
    } catch (error) {
      console.error(error);
      this.notificationService.error('No se pudo actualizar el estado operativo del usuario.');
    } finally {
      this.guardandoId = '';
    }
  }

  abrirFormCrear(): void {
    this.nuevoCorreo = '';
    this.nuevoPassword = '';
    this.nuevoNombreAsignado = '';
    this.errorCrearForm = '';
    this.mostrandoFormCrear = true;
  }

  cerrarFormCrear(): void {
    this.mostrandoFormCrear = false;
  }

  cerrarModalPendiente(): void {
    this.mostrandoModalPendiente = false;
  }

  async crearNuevoUsuario(): Promise<void> {
    this.errorCrearForm = '';

    const correo = this.nuevoCorreo.trim();
    const password = this.nuevoPassword.trim();
    const nombre = this.nuevoNombreAsignado.trim();

    if (!correo || !password || !nombre) {
      this.errorCrearForm = 'Todos los campos son obligatorios.';
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(correo)) {
      this.errorCrearForm = 'El correo no tiene un formato válido.';
      return;
    }

    if (password.length < 6) {
      this.errorCrearForm = 'La contraseña debe tener al menos 6 caracteres.';
      return;
    }

    try {
      this.creandoUsuario = true;
      await this.rockolaService.crearUsuarioDesdeAdmin(
        { correo, password, nombreUsuarioBar: nombre },
        this.nombreBar
      );
      this.mostrandoFormCrear = false;
      this.mostrandoModalPendiente = true;
      this.cargarUsuarios();
    } catch (error: any) {
      this.errorCrearForm = error?.message || 'No se pudo crear el usuario. Intenta de nuevo.';
    } finally {
      this.creandoUsuario = false;
    }
  }
}
