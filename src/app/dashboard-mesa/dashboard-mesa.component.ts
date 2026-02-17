// LAS IMPORTACIONES CORRECTAS:
import { Component, OnInit } from '@angular/core'; // <--- ESTO DEBE SER @angular/core
import { ActivatedRoute } from '@angular/router';
import { RockolaService } from '../services/rockola.service';
import { SpotifyService } from '../services/spotify-auth.service';
import { Observable, Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, map } from 'rxjs/operators';
import { trigger, transition, style, animate, query, group } from '@angular/animations';

// Definición de interfaces para que el buscador funcione aquí dentro
export interface Track {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { images: { url: string }[] };
  uri: string;
}

@Component({
  selector: 'app-dashboard-mesa',
  templateUrl: './dashboard-mesa.component.html',
  styleUrls: ['./dashboard-mesa.component.scss'],
  animations: [
    trigger('slideContent', [
      transition('songs => products', [
        group([
          query(':enter', [
            style({ transform: 'translateX(100%)', opacity: 0 }),
            animate('400ms ease-out', style({ transform: 'translateX(0%)', opacity: 1 }))
          ], { optional: true }),
          query(':leave', [
            animate('400ms ease-out', style({ transform: 'translateX(-100%)', opacity: 0 }))
          ], { optional: true })
        ])
      ]),
      transition('products => songs', [
        group([
          query(':enter', [
            style({ transform: 'translateX(-100%)', opacity: 0 }),
            animate('400ms ease-out', style({ transform: 'translateX(0%)', opacity: 1 }))
          ], { optional: true }),
          query(':leave', [
            animate('400ms ease-out', style({ transform: 'translateX(100%)', opacity: 0 }))
          ], { optional: true })
        ])
      ])
    ])
  ]
})
export class DashboardMesaComponent implements OnInit {
  // --- Variables de URL y Estado ---
  nombreBarUrl: string = '';
  idMesaUrl: string = '';
  numeroMesaReal: number | null = null;
  nombreBarReal: string = ''; 
  barValido: boolean = false;
  errorMensaje: string = '';

  // --- Control de Acceso y Navegación ---
  codigoIngresado: string = '';
  accesoAutorizado: boolean = false;
  cargandoValidacion: boolean = true;
  vistaActual: 'songs' | 'products' = 'songs';

  // --- Lógica del Buscador (Tus funciones originales) ---
  query: string = '';
  tracks: Track[] = [];
  private buscador$ = new Subject<string>();
  misCanciones$: Observable<any[]> | null = null;

  constructor(
    private route: ActivatedRoute,
    private rockolaService: RockolaService,
    private spotifyService: SpotifyService 
  ) {}

  async ngOnInit() {
    const parametroUrl = this.route.snapshot.paramMap.get('nombreBar') || '';
    this.nombreBarUrl = parametroUrl.toLowerCase().trim().replace(/\s+/g, ''); 
    this.idMesaUrl = this.route.snapshot.paramMap.get('idMesa') || '';

    await this.verificarExistenciaDelBar();

    if (this.barValido) {
      await this.obtenerDatosDeLaMesa();
      this.configurarBuscadorFluido();
      await this.verificarSesionExistente();
    }
    
    this.cargandoValidacion = false;
  }

  // --- TUS 240 LÍNEAS DE LÓGICA REINTEGRADAS ---

  private configurarBuscadorFluido() {
    this.buscador$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(texto => {
        if (!texto || texto.length < 3) {
          this.tracks = [];
          return of([]);
        }
        return this.spotifyService.buscarTracks(texto);
      })
    ).subscribe({
      next: (canciones: any) => this.tracks = canciones,
      error: (err) => console.error("Error en flujo Spotify:", err)
    });
  }

  async verificarExistenciaDelBar() {
    try {
      const datosBar: any = await this.rockolaService.verificarExistenciaBar(this.nombreBarUrl);
      if (datosBar) {
        this.barValido = true;
        this.nombreBarReal = datosBar.nombreBar; 
      } else {
        this.barValido = false;
        this.errorMensaje = `El establecimiento "${this.nombreBarUrl}" no existe.`;
      }
    } catch (error) {
      this.barValido = false;
      this.errorMensaje = "Error de conexión con el servidor.";
    }
  }

  async obtenerDatosDeLaMesa() {
    const datosMesa = await this.rockolaService.obtenerDatosMesa(this.idMesaUrl);
    if (datosMesa) this.numeroMesaReal = datosMesa.numero;
  }

  async verificarSesionExistente() {
    const storageKey = `codigo_${this.nombreBarUrl.toLowerCase()}`;
    const codigoGuardado = localStorage.getItem(storageKey);
    if (codigoGuardado) {
      const esValido = await this.rockolaService.validarCodigoBar(this.nombreBarUrl, codigoGuardado);
      if (esValido) {
        this.accesoAutorizado = true;
        this.cargarMisPedidos();
      } else {
        localStorage.removeItem(storageKey);
      }
    }
  }

  async validarAcceso() {
    if (this.codigoIngresado.length !== 4) return;
    const esValido = await this.rockolaService.validarCodigoBar(this.nombreBarUrl, this.codigoIngresado);
    if (esValido) {
      localStorage.setItem(`codigo_${this.nombreBarUrl.toLowerCase()}`, this.codigoIngresado);
      this.accesoAutorizado = true;
      this.cargarMisPedidos();
    } else {
      alert("Código incorrecto.");
      this.codigoIngresado = '';
    }
  }

  cargarMisPedidos() {
    this.misCanciones$ = this.rockolaService.obtenerMisSolicitudes(this.nombreBarUrl, this.idMesaUrl).pipe(
      map((canciones: any[]) => {
        return canciones.sort((a: any, b: any) => {
          if (a.estado === 'pendiente' && b.estado !== 'pendiente') return -1;
          if (a.estado !== 'pendiente' && b.estado === 'pendiente') return 1;
          const tiempoA = a.timestamp?.seconds || a.timestamp || 0;
          const tiempoB = b.timestamp?.seconds || b.timestamp || 0;
          return tiempoB - tiempoA;
        });
      })
    );
  }

  onSearchChange() {
    const busqueda = this.query.trim();
    if (busqueda.length === 0) {
      this.tracks = [];
      this.buscador$.next('');
      return;
    }
    if (busqueda.length >= 3) this.buscador$.next(busqueda);
  }

  async seleccionarCancion(track: Track) {
    try {
      const storageKey = `codigo_${this.nombreBarUrl.toLowerCase()}`;
      const codigoGuardado = localStorage.getItem(storageKey);
      const esValido = await this.rockolaService.validarCodigoBar(this.nombreBarUrl, codigoGuardado || '');

      if (!esValido) {
        alert("La sesión ha expirado.");
        this.accesoAutorizado = false;
        return;
      }

      await this.rockolaService.enviarSolicitud(track, this.nombreBarUrl, this.idMesaUrl, this.numeroMesaReal || '?');
      alert(`¡"${track.name}" añadida!`);
      this.query = '';
      this.tracks = [];
    } catch (error) {
      alert("No se pudo enviar la canción.");
    }
  }

  obtenerArtistas(track: Track): string {
    return track.artists.map(a => a.name).join(', ');
  }

  cambiarVista(nuevaVista: 'songs' | 'products') {
    this.vistaActual = nuevaVista;
  }
}