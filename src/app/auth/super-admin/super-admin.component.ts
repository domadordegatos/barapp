import { Component, OnInit } from '@angular/core';
import { RockolaService } from '../../services/rockola.service';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { map } from 'rxjs';
import { Router } from '@angular/router';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-super-admin',
  templateUrl: './super-admin.component.html',
  styleUrls: ['./super-admin.component.scss']
})
export class SuperAdminComponent implements OnInit {
  usuarios: any[] = [];
  filtroNombre: string = '';
  filtroEstado: 'todos' | 'activos' | 'inactivos' | 'pendientes-admin' = 'todos';
  guardandoId: string = '';

  constructor(
  private firestore: AngularFirestore, 
  public rockolaService: RockolaService, // Inyectamos el servicio
  private router: Router,
  private notificationService: NotificationService
) {}

  ngOnInit() {
    this.cargarUsuarios();
  }

  get usuariosFiltrados(): any[] {
    const termino = (this.filtroNombre || '').toLowerCase().trim();

    let lista = [...this.usuarios];

    if (termino) {
      lista = lista.filter((u: any) => {
        const nombre = String(u?.nombreBar || '').toLowerCase();
        const correo = String(u?.correo || '').toLowerCase();
        return nombre.includes(termino) || correo.includes(termino);
      });
    }

    if (this.filtroEstado === 'activos') {
      return lista.filter((u: any) => u?.estado === true);
    }

    if (this.filtroEstado === 'inactivos') {
      return lista.filter((u: any) => u?.estado === false);
    }

    if (this.filtroEstado === 'pendientes-admin') {
      return lista.filter((u: any) => u?.tipo === 'admin' && u?.estado === false);
    }

    return lista;
  }

  contarPorEstado(estado: boolean): number {
    return this.usuarios.filter((u: any) => u?.estado === estado).length;
  }

  contarPendientesAdmin(): number {
    return this.usuarios.filter((u: any) => u?.tipo === 'admin' && u?.estado === false).length;
  }

  logout() {
  if (confirm('¿Deseas salir del Panel Maestro?')) {
    sessionStorage.removeItem('usuarioAdmin'); // Limpiamos la sesión
    this.router.navigate(['/']); // Redirigimos al Login
  }
}

  cargarUsuarios() {
    this.firestore.collection('usuarios_bares', ref => ref.orderBy('nombreBar', 'asc'))
      .snapshotChanges()
      .pipe(
        map(actions => actions.map(a => {
          const data = a.payload.doc.data() as any;
          const id = a.payload.doc.id;
          return { id, ...data };
        }))
      ).subscribe(res => this.usuarios = res);
  }

  toggleEstadoLocal(u: any) {
    if (u?.correo === this.rockolaService.CORREO_MASTER) {
      return;
    }

    u.estado = !u.estado;
  }

  async actualizarUsuario(u: any) {
    if (u?.correo === this.rockolaService.CORREO_MASTER) {
      this.notificationService.warning('No se puede editar el usuario master.');
      return;
    }

    if (!u?.nombreBar || !u?.correo) {
      this.notificationService.warning('Nombre de bar y correo son obligatorios.');
      return;
    }

    try {
      this.guardandoId = u.id;
      await this.firestore.collection('usuarios_bares').doc(u.id).update({
        nombreBar: String(u.nombreBar || '').trim(),
        correo: String(u.correo || '').trim().toLowerCase(),
        estado: u.estado,
        tipo: u.tipo,
        codigoRegistroInvitados: u.tipo === 'admin'
          ? String(u.codigoRegistroInvitados || '1234').trim()
          : ''
      });
      this.notificationService.success('Usuario actualizado con éxito.');
    } catch (e) {
      console.error(e);
      this.notificationService.error('Error al actualizar.');
    } finally {
      this.guardandoId = '';
    }
  }
}