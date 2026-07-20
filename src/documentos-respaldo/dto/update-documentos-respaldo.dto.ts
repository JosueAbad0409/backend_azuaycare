import { PartialType } from '@nestjs/mapped-types';
import { CreateDocumentosRespaldoDto } from './create-documentos-respaldo.dto';

export class UpdateDocumentosRespaldoDto extends PartialType(CreateDocumentosRespaldoDto) {}