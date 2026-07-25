import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter'; 
import { AuthModule } from './auth/auth.module';
import { Role } from './roles/entities/role.entity';
import { RolesModule } from './roles/roles.module';
import { Usuario } from './usuarios/entities/usuario.entity';
import { UsuariosModule } from './usuarios/usuarios.module';
import { CarrerasModule } from './carreras/carreras.module';
import { Carrera } from './carreras/entities/carrera.entity';
import { CiclosModule } from './ciclos/ciclos.module'; 
import { Ciclo } from './ciclos/entities/ciclo.entity'; 
import { PeriodosMatriculaModule } from './periodos-matricula/periodos-matricula.module';
import { PeriodoMatricula } from './periodos-matricula/entities/periodos-matricula.entity';
import { FormulariosModule } from './formularios/formularios.module';
import { Formulario } from './formularios/entities/formulario.entity'; 
import { SeccionesModule } from './secciones/secciones.module';
import { Seccion } from './secciones/entities/secciones.entity';
import { TiposCampoFormModule } from './tipos-campo-form/tipos-campo-form.module';
import { TipoCampoForm } from './tipos-campo-form/entities/tipos-campo-form.entity'; 
import { PreguntasModule } from './preguntas/preguntas.module';
import { Pregunta } from './preguntas/entities/pregunta.entity';
import { OpcionesPreguntaModule } from './opciones-pregunta/opciones-pregunta.module';
import { OpcionPregunta } from './opciones-pregunta/entities/opciones-pregunta.entity'; 
import { RespuestasFormularioModule } from './respuestas-formulario/respuestas-formulario.module';
import { RespuestasFormulario } from './respuestas-formulario/entities/respuestas-formulario.entity'; 
import { FichasRespondidasModule } from './fichas-respondidas/fichas-respondidas.module';
import { FichaRespondida } from './fichas-respondidas/entities/ficha-respondida.entity'; 
import { NivelesEconomicosModule } from './niveles-economicos/niveles-economicos.module';
import { NivelesEconomico } from './niveles-economicos/entities/niveles-economico.entity'; 
import { ReportesModule } from './reportes/reportes.module';
import { PreguntasDependenciasModule } from './preguntas-dependencias/preguntas-dependencias.module';
import { PreguntaDependencia } from './preguntas-dependencias/entities/pregunta-dependencia.entity';
import { MatricesFormModule } from './matrices-form/matrices-form.module';
import { FilaMatriz } from './matrices-form/entities/fila-matriz.entity';
import { ColumnaMatriz } from './matrices-form/entities/columna-matriz.entity';
import { DocumentosRespaldoModule } from './documentos-respaldo/documentos-respaldo.module';
import { DocumentoRespaldo } from './documentos-respaldo/entities/documentos-respaldo.entity';
import { AuditoriaModule } from './auditoria/auditoria.module';
import { CoordinadoresCarrerasModule } from './coordinadores-carreras/coordinadores-carreras.module';
import { HistorialEstadosFichaModule } from './historial-estados-ficha/historial-estados-ficha.module';
import { HistorialRespuestasModule } from './historial-respuestas/historial-respuestas.module';
import { RespuestasMatrizModule } from './respuestas-matriz/respuestas-matriz.module';
import { Auditoria } from './auditoria/entities/auditoria.entity';
import { CoordinadoresCarrera } from './coordinadores-carreras/entities/coordinadores-carrera.entity';
import { HistorialEstadosFicha } from './historial-estados-ficha/entities/historial-estados-ficha.entity';
import { HistorialRespuesta } from './historial-respuestas/entities/historial-respuesta.entity';
import { RespuestasMatriz } from './respuestas-matriz/entities/respuestas-matriz.entity';
import { PerfilCoordinadorModule } from './perfil-coordinador/perfil-coordinador.module';
import { RespuestaOpcionSeleccionada } from './respuestas-formulario/entities/respuestas-opciones-seleccionadas.entity';
import { PerfilCoordinador } from './perfil-coordinador/entities/perfil-coordinador.entity';
import { Throttle, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    CacheModule.register({isGlobal: true }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]), 
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        url: configService.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: true,
        logging: configService.get<string>('NODE_ENV') !== 'production',
      }),
    }),
    
    AuthModule,
    RolesModule,
    UsuariosModule,
    CarrerasModule,
    CiclosModule,
    PeriodosMatriculaModule,
    FormulariosModule,
    SeccionesModule,
    TiposCampoFormModule,
    PreguntasModule,
    OpcionesPreguntaModule,
    RespuestasFormularioModule,
    FichasRespondidasModule,
    NivelesEconomicosModule,
    ReportesModule,
    PreguntasDependenciasModule,
    MatricesFormModule,
    DocumentosRespaldoModule,
    AuditoriaModule,
    CoordinadoresCarrerasModule,
    HistorialEstadosFichaModule,
    HistorialRespuestasModule,
    RespuestasMatrizModule,
    PerfilCoordinadorModule, 
  ],
  providers:[
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}


