// Interfaz sugerida para usar en tu componente
export interface Producto {
  nombre: string;
  precio: number;
  categoria: string;
  existencias: number;
  controlInventario: boolean; // Si es false, no descuenta stock
  disponible: boolean;
}