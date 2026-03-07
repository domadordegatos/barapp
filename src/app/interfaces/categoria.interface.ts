export interface Categoria {
  id: string;
  nombre: string;
  // Permite otras propiedades que puedan venir de Firestore
  [key: string]: any;
}