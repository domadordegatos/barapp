import { Component, OnInit, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { RockolaService } from '../../services/rockola.service';
import { SpotifyService } from '../../services/spotify-auth.service';
import { Observable, Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, map } from 'rxjs/operators';

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
export class BuscarCancionesComponent implements OnInit, OnChanges {
  @Input() nombreBarUrl: string = '';
  @Input() idMesaUrl: string = '';
  @Input() numeroMesaReal: number | null = null;
  @Input() nombreBarReal: string = ''; 

  barValido: boolean = false;
  accesoAutorizado: boolean = false;
  cargandoValidacion: boolean = true;

  query: string = '';
  tracks: Track[] = [];
  private buscador$ = new Subject<string>();
  misCanciones$: Observable<any[]> | null = null;

  constructor(
    private route: ActivatedRoute,
    private rockolaService: RockolaService,
    private spotifyService: SpotifyService
  ) {}

  // CLAVE ÚNICA CONSISTENTE
  get storageKey(): string {
    return `codigo_${this.nombreBarUrl.toLowerCase()}_${this.idMesaUrl}`;
  }

  async ngOnInit() {
    if (this.nombreBarUrl) {
      await this.verificarExistenciaDelBar();
      if (this.barValido) {
        this.configurarBuscador();
        await this.verificarSesionExistente();
      }
    }
    this.cargandoValidacion = false;
  }

  ngOnChanges(changes: SimpleChanges) {
    if ((changes['nombreBarUrl'] || changes['idMesaUrl']) && this.nombreBarUrl && this.idMesaUrl) {
      this.cargarMisPedidos();
    }
  }

  configurarBuscador() {
    this.buscador$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(texto => (!texto || texto.length < 3) ? of([]) : this.spotifyService.buscarTracks(texto))
    ).subscribe({
      next: (canciones: any) => this.tracks = canciones,
      error: (err) => console.error("Error en búsqueda:", err)
    });
  }

  async verificarExistenciaDelBar() {
    try {
      const datosBar: any = await this.rockolaService.verificarExistenciaBar(this.nombreBarUrl);
      if (datosBar) {
        this.barValido = true;
        this.nombreBarReal = datosBar.nombreBar; 
      }
    } catch (error) { this.barValido = false; }
  }

  async verificarSesionExistente() {
    const codigoGuardado = localStorage.getItem(this.storageKey);
    if (codigoGuardado) {
      const esValido = await this.rockolaService.validarCodigoBar(this.nombreBarUrl, codigoGuardado);
      if (esValido) {
        this.accesoAutorizado = true;
        this.cargarMisPedidos();
      } else {
        localStorage.removeItem(this.storageKey);
        this.accesoAutorizado = false;
      }
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
    if (busqueda.length === 0) { this.tracks = []; this.buscador$.next(''); return; }
    if (busqueda.length >= 3) this.buscador$.next(busqueda);
  }

  async seleccionarCancion(track: Track) {
    try {
      const codigoGuardado = localStorage.getItem(this.storageKey);
      
      // Volvemos a validar contra el servidor para estar seguros
      const esValido = await this.rockolaService.validarCodigoBar(this.nombreBarUrl, codigoGuardado || '');

      if (!esValido) {
        alert("La sesión ha expirado o el código cambió.");
        localStorage.removeItem(this.storageKey);
        this.accesoAutorizado = false;
        return;
      }

      await this.rockolaService.enviarSolicitud(
        track, 
        this.nombreBarUrl, 
        this.idMesaUrl,            
        this.numeroMesaReal || 0 
      );
      
      alert(`¡"${track.name}" añadida!`);
      this.query = '';
      this.tracks = [];
      
    } catch (error) {
      console.error(error);
      alert("Error al enviar canción.");
    }
  }

  obtenerArtistas(track: Track): string {
    return track.artists.map(a => a.name).join(', ');
  }
}
