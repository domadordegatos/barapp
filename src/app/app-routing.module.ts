import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BuscarCancionesComponent } from './music/buscar-canciones/buscar-canciones.component';
import { AdminPedidosComponent } from './music/admin-pedidos/admin-pedidos.component';
import { RegistroAdminComponent } from './auth/registro-admin/registro-admin.component';
import { LoginComponent } from './auth/login/login.component';
import { AuthGuard } from './guards/auth.guard'; // Importalo arriba
import { SuperAdminComponent } from './auth/super-admin/super-admin.component';
import { SuperAdminGuard } from './guards/super-admin.guard';

const routes: Routes = [
  { path: '', component: LoginComponent, pathMatch: 'full' },
  { path: 'registro', component: RegistroAdminComponent },
  { 
    path: 'super-admin-panel', 
    component: SuperAdminComponent, 
    canActivate: [SuperAdminGuard] 
  },

  // CORRECCIÓN: Subimos la ruta de Admin ANTES de la de Cliente
  { 
    path: ':nombreBar/admin/gestion', 
    component: AdminPedidosComponent,
    canActivate: [AuthGuard] 
  },

  // Ruta de Cliente (Mesa) - Se queda abajo por ser más genérica
  { 
    path: ':nombreBar/:idMesa', 
    component: BuscarCancionesComponent
  },
  
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }