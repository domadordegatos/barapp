import { Component, OnInit } from '@angular/core';
import { RockolaService } from '../../services/rockola.service';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { map } from 'rxjs';
import { Router } from '@angular/router';

@Component({
  selector: 'app-super-admin',
  templateUrl: './super-admin.component.html',
  styleUrls: ['./super-admin.component.scss']
})
export class SuperAdminComponent implements OnInit {
  usuarios: any[] = [];
  filtroNombre: string = '';

  constructor(
  private firestore: AngularFirestore, 
  public rockolaService: RockolaService, // Inyectamos el servicio
  private router: Router
) {}

  ngOnInit() {
    this.cargarUsuarios();
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

  async actualizarUsuario(u: any) {
    try {
      await this.firestore.collection('usuarios_bares').doc(u.id).update({
        nombreBar: u.nombreBar,
        correo: u.correo,
        estado: u.estado,
        tipo: u.tipo,
        codigoRegistroInvitados: u.codigoRegistroInvitados || ""
      });
      alert("Usuario actualizado con éxito");
    } catch (e) {
      console.error(e);
      alert("Error al actualizar");
    }
  }
}