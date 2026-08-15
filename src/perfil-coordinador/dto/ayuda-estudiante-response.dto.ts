export class PerfilAyudaDto {
  id: string;
  nombreCompleto: string;
  cargo: string | null;
  mensajeAyuda: string | null;
  correo: string | null;
  telefono: string | null;
  horarioAtencion: string | null;
  ubicacion: string | null;
  fotoUrl: string | null;
}

export class AyudaEstudianteResponseDto {
  bienestarEstudiantil: PerfilAyudaDto | null;
  coordinadoresCarrera: PerfilAyudaDto[];
}