import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { RockolaService } from '../services/rockola.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

export interface Track {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { images: { url: string }[] };
  uri: string;
}

@Component({
  selector: 'app-buscar-canciones',
  templateUrl: './buscar-canciones.component.html',
  styleUrls: ['./buscar-canciones.component.scss']
})
export class BuscarCancionesComponent implements OnInit {
  query: string = '';
  tracks: Track[] = [];
  mesaCodigo: string = ''; 
  mesaNumero: number | null = null; 
  mesaValida: boolean = false;
  cargandoMesa: boolean = true;
  
  private buscador$ = new Subject<string>();
  misCanciones$: Observable<any[]> | null = null;

  constructor(
    private route: ActivatedRoute,
    private rockolaService: RockolaService,
    private http: HttpClient
  ) {}

  async ngOnInit() {
    this.mesaCodigo = this.route.snapshot.paramMap.get('id') || '';

    // 1. Configurar el observador del buscador ANTES de cualquier otra cosa
    this.buscador$.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe(texto => {
      console.log('Buscando:', texto); // Para verificar en consola si entra
      this.ejecutarBusqueda(texto);
    });

    // 2. Validar mesa
    const datos = await this.rockolaService.obtenerDatosMesa(this.mesaCodigo);
    if (datos && datos.activa) {
      this.mesaValida = true;
      this.mesaNumero = datos.numero;
      this.misCanciones$ = this.rockolaService.obtenerMisSolicitudes(this.mesaCodigo);
    }
    this.cargandoMesa = false;
  }

  onSearchChange() {
    const busqueda = this.query.trim();
    if (busqueda.length >= 3) {
      this.buscador$.next(busqueda);
    } else {
      this.tracks = [];
    }
  }

  private ejecutarBusqueda(termino: string) {
    // IMPORTANTE: Asegúrate de que el token sea vigente (duran 60 min)
    const token = 'BQA9vopJ5ewJK-kz0gZWXEdt4DlKyGjWO1PE_Oe5GiLlD-rD4rnkb97-bmLpa7b9X1MoQq_HLoCc-WYWYECP4-zcb3GDHYW3xKPdBBUGmdiT6wcThe4Sqc2eKSMKoGOPBHu9uNSL68tMOsNueup7lMu67aWS2PGqq-7djlToYvaR7oLzAFcEZMzQIBBB0sh0PJ-cGltoS0KsmRnrShdB_dVUYsuvejHsrVm08RbOTHH4sS-Qsjk4sAX-CRrvVAl-KiHvlREbb4aj7wIeHEy3ZD-iEmFDyDgqV3dhZQk1yRgAR3gw_xteF0NI9Xhd2-dESwsA'; 
    
    // CORRECCIÓN DE URL: Se debe usar backticks (``) y el endpoint oficial
    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(termino)}&type=track&limit=10`;
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    this.http.get<any>(url, { headers }).subscribe({
      next: (res) => {
        this.tracks = res.tracks.items;
      },
      error: (err) => {
        console.error("Error en la API de Spotify:", err);
        if(err.status === 401) alert("El token de Spotify ha expirado");
      }
    });
  }

  async seleccionarCancion(track: Track) {
    try {
      if (!this.mesaValida || this.mesaNumero === null) return;

      // Enviamos con el campo 'finalizado' para tu historial
      await this.rockolaService.enviarSolicitud(track, this.mesaCodigo, this.mesaNumero);
      
      alert(`¡Canción enviada a la Mesa ${this.mesaNumero}!`);
      this.query = '';
      this.tracks = [];
    } catch (error) {
      console.error("Error al enviar solicitud:", error);
    }
  }

  obtenerArtistas(track: Track): string {
    return track.artists.map(a => a.name).join(', ');
  }
}