import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BuscarCancionesComponent } from './buscar-canciones/buscar-canciones.component';
import { AdminPedidosComponent } from './admin-pedidos/admin-pedidos.component';
import { RegistroAdminComponent } from './registro-admin/registro-admin.component';
import { LoginComponent } from './login/login.component';
import { AuthGuard } from './auth.guard'; // Importalo arriba

const routes: Routes = [
  // 1. La raíz ahora es el Login
  { 
    path: '', 
    component: LoginComponent, // Asegúrate de haber creado este componente
    pathMatch: 'full' 
  },

  // 2. Ruta explícita para registro
  { 
    path: 'registro', 
    component: RegistroAdminComponent 
  },

  // 3. Cliente (Mesa)
  { 
    path: 'mesa/:id', 
    component: BuscarCancionesComponent 
  },
  
  // 4. Admin
  { 
    path: 'admin/gestion', 
    component: AdminPedidosComponent,
    canActivate: [AuthGuard] // <--- AQUÍ activamos el cerrojo
  },

  // 5. Comodín: Cualquier error vuelve al Login
  { 
    path: '**', 
    redirectTo: '' 
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }