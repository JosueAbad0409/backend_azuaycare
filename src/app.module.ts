import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        host: configService.get<string>('DB_HOST') ?? 'localhost',
        port: Number(configService.get<string>('DB_PORT') ?? '5432'),
        username: configService.get<string>('DB_USERNAME') ?? 'postgres',
        password: String(configService.get<string>('DB_PASSWORD') ?? ''),
        database: configService.get<string>('DB_DATABASE') ?? 'postgres',
        entities: [
          Usuario, 
          Role, 
          Carrera, 
          Ciclo, 
          PeriodoMatricula, 
          Formulario, 
          Seccion, 
          TipoCampoForm, 
          Pregunta, 
          OpcionPregunta,
          RespuestasFormulario,
          FichaRespondida 
        ],
        synchronize: configService.get<string>('NODE_ENV') !== 'production',
        logging: configService.get<string>('NODE_ENV') !== 'production',
        ssl:
          configService.get<string>('DB_SSL') === 'true'
            ? { rejectUnauthorized: false }
            : false,
      }),
    }),
    RolesModule,
    UsuariosModule,
    AuthModule,
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
  ],
})
export class AppModule {}