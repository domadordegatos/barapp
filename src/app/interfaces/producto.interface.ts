import { Timestamp } from 'firebase/firestore';

// Interfaz sugerida para usar en tu componente
export interface Producto {
  nombre: string;
  precio: number;
  valorCompra: number;
  categoria: string;
  existencias: number;
  controlInventario: boolean; // Si es false, no descuenta stock
  disponible: boolean;
  visible: boolean;
}

export interface SolicitudCancion {
  id?: string;
  mesaId: string;
  cancion: string;
  artista: string;
  foto: string;
  trackId: string;
  fechaHora: Timestamp;
  estado: 'pendiente' | 'aprobado' | 'rechazado' | 'reproduciendo';
}

export interface Mesa {
  id: string;
  activa: boolean;
  codigo: string;
  totalAcumulado: number;
}