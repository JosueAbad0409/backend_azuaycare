<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
# Backend-Azuaycore

# AzuayCare - Backend

API REST de **AzuayCare**, sistema de gestión de fichas socioeconómicas y de bienestar estudiantil de la **Universidad del Azuay**.

Backend desarrollado con **NestJS + TypeORM + PostgreSQL**. Gestiona autenticación, formularios dinámicos, respuestas de estudiantes, revisión de fichas, reportes, auditoría, generación de PDFs y más.

---

## Tabla de contenidos

- [Características](#características)
- [Stack tecnológico](#stack-tecnológico)
- [Roles del sistema](#roles-del-sistema)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Requisitos previos](#requisitos-previos)
- [Instalación](#instalación)
- [Variables de entorno](#variables-de-entorno)
- [Ejecución](#ejecución)
- [CORS](#cors)
- [Módulos principales](#módulos-principales)
- [Autenticación](#autenticación)
- [Notas importantes](#notas-importantes)
- [Frontend asociado](#frontend-asociado)
- [Despliegue sugerido](#despliegue-sugerido)

---

## Características

- Autenticación con **Google** + JWT
- Sistema de roles y guards de autorización
- CRUD completo de catálogos (Carreras, Ciclos, Periodos de matrícula, etc.)
- Constructor de formularios dinámicos:
  - Secciones
  - Preguntas de múltiples tipos
  - Opciones con ponderación y dependencias
  - Matrices (filas y columnas)
  - Rangos de variables calculadas (vulnerabilidad)
- Gestión de fichas respondidas y respuestas
- Historial de estados de ficha e historial de respuestas
- Carga de documentos de respaldo
- Revisión de fichas por coordinadores
- Generación de reportes
- Auditoría de acciones
- Generación de PDFs y plantillas
- Envío de correos electrónicos
- Módulo de IA (preparado)
- Rate limiting (Throttler)
- Caché global
- Validación de cédula ecuatoriana
- Filtro global de excepciones
- Helmet + Compression

---

## Stack tecnológico

| Tecnología              | Uso                                      |
|-------------------------|------------------------------------------|
| NestJS                  | Framework principal                      |
| TypeORM                 | ORM                                      |
| PostgreSQL              | Base de datos                            |
| JWT + Passport          | Autenticación                            |
| Google Auth             | Login con Google                         |
| Class Validator         | Validación de DTOs                       |
| Helmet                  | Seguridad HTTP                           |
| Compression             | Compresión de respuestas                 |
| Throttler               | Rate limiting                            |
| Cache Manager           | Caché en memoria                         |
| Event Emitter           | Eventos internos                         |
| PDF (módulo propio)     | Generación de documentos PDF             |

---

## Roles del sistema

| Rol                        | Descripción                                      |
|---------------------------|--------------------------------------------------|
| `ESTUDIANTE`              | Completa fichas y sube documentos                |
| `INVITADO`                | Acceso limitado                                  |
| `COORDINADOR_CARRERA`     | Gestión y revisión de fichas de su carrera       |
| `COORDINADOR_BIENESTAR`   | Acceso total (incluye auditoría)                 |

---

## Estructura del proyecto

```
src/
├── main.ts
├── app.module.ts
├── auth/                           # Login Google, JWT, Guards, Strategies
│   ├── decorators/
│   ├── dto/
│   ├── guards/
│   ├── interfaces/
│   └── strategies/
├── usuarios/
├── roles/
├── carreras/
├── ciclos/
├── periodos-matricula/
├── formularios/
├── secciones/
├── preguntas/
├── opciones-pregunta/
├── tipos-campo-form/
├── tipos-formulario/
├── matrices-form/                  # Filas y columnas de matrices
├── rangos-variable-calculada/
├── fichas-respondidas/
├── respuestas-formulario/
├── respuestas-matriz/
├── historial-estados-ficha/
├── historial-respuestas/
├── documentos-respaldo/
├── reportes/
├── auditoria/
├── coordinadores-carreras/
├── perfil-coordinador/
├── niveles-economicos/
├── plantillas-pdf/
├── mail/
├── ia/
├── common/                         # Validadores, PDF, utilidades
│   ├── is-cedula-ecuatoriana.validator.ts
│   └── pdf/
└── filters/                        # Global exception filter
```

---

## Requisitos previos

- Node.js 18 o superior (recomendado 20+)
- npm o yarn
- PostgreSQL (local o remoto)
- Cuenta de Google Cloud (para OAuth) si se va a usar login con Google

---

## Instalación

```bash
# Clonar el repositorio
git clone <url-del-repositorio-backend>
cd <nombre-carpeta-backend>

# Instalar dependencias
npm install
```

---

## Variables de entorno

Crea un archivo `.env` en la raíz del proyecto con el siguiente contenido:

```env
# ===========================================
# BASE DE DATOS
# ===========================================
DATABASE_URL=

# ===========================================
# ENTORNO
# ===========================================
NODE_ENV=development
# NODE_ENV=production

# ===========================================
# SERVIDOR
# ===========================================
PORT=3000

# ===========================================
# JWT
# ===========================================
JWT_SECRET=tu_secreto_jwt_muy_seguro_y_largo

# ===========================================
# GOOGLE OAUTH (opcional según implementación)
# ===========================================
GOOGLE_CLIENT_ID=

# ===========================================
# CORREO (si se utiliza el módulo mail)
# ===========================================
# MAIL_HOST=smtp.example.com
# MAIL_PORT=587
# MAIL_USER=usuario@example.com
# MAIL_PASSWORD=tu_password
# MAIL_FROM="AzuayCare <noreply@azuaycare.com>"
```

> **Importante:**  
> - En producción **nunca** uses `synchronize: true` de TypeORM.  
> - Cambia el `JWT_SECRET` por un valor seguro y único.

---

## Ejecución

```bash
# Modo desarrollo (con hot reload)
npm run start:dev

# Modo producción
npm run build
npm run start:prod

# Solo build
npm run build
```

La API se levanta por defecto en:
```
http://localhost:3000
```

El servidor escucha en `0.0.0.0` para aceptar conexiones externas.

---

## CORS

El backend está configurado para aceptar peticiones desde:

| Origen                              | Uso                    |
|-------------------------------------|------------------------|
| `http://localhost:8087`             | Frontend en desarrollo |
| `https://azuaycarev1.netlify.app`   | Frontend en producción |

Si necesitas agregar más orígenes, modifica la configuración de CORS en `src/main.ts`.

---

## Módulos principales

| Módulo                        | Prefijo / Función principal                     |
|-------------------------------|-------------------------------------------------|
| `auth`                        | `/auth` - Login con Google y emisión de JWT     |
| `usuarios`                    | `/usuarios` - Gestión de usuarios y perfiles    |
| `roles`                       | Roles del sistema                               |
| `carreras`                    | `/carreras` - Catálogo de carreras              |
| `ciclos`                      | `/ciclos` - Ciclos académicos                   |
| `periodos-matricula`          | Periodos de matrícula                           |
| `formularios`                 | Formularios dinámicos                           |
| `secciones`                   | Secciones de formularios                        |
| `preguntas`                   | Preguntas                                       |
| `opciones-pregunta`           | Opciones de preguntas                           |
| `matrices-form`               | Filas y columnas de matrices                    |
| `rangos-variable-calculada`   | Rangos de vulnerabilidad                        |
| `fichas-respondidas`          | Fichas enviadas por estudiantes                 |
| `respuestas-formulario`       | Respuestas de campos normales                   |
| `respuestas-matriz`           | Respuestas de matrices                          |
| `historial-estados-ficha`     | Historial de estados de la ficha                |
| `historial-respuestas`        | Historial de cambios en respuestas              |
| `documentos-respaldo`         | Documentos subidos por el estudiante            |
| `reportes`                    | Generación de reportes                          |
| `auditoria`                   | Logs de auditoría                               |
| `mail`                        | Envío de correos                                |
| `plantillas-pdf` + `pdf`      | Generación de PDFs                              |
| `ia`                          | Módulo de inteligencia artificial (preparado)   |

> La mayoría de endpoints protegidos requieren el header:
> ```
> Authorization: Bearer <token>
> ```

---

## Autenticación

1. El frontend envía el token de Google al endpoint de login.
2. El backend valida el token, busca o crea el usuario y emite un **JWT**.
3. El JWT contiene información del usuario (id, email, nombre, rol, carrera_id, etc.).
4. Los guards `JwtAuthGuard` y `RolesGuard` protegen los endpoints según el rol.

Decorador disponible:
```typescript
@Roles('COORDINADOR_BIENESTAR', 'COORDINADOR_CARRERA')
```

---

## Notas importantes

- Se utiliza `autoLoadEntities: true`.
- `synchronize` solo se activa cuando `NODE_ENV !== 'production'`.
- Existe un validador personalizado de **cédula ecuatoriana**.
- Se implementa un **Global Exception Filter**.
- Rate limiting configurado (100 requests por minuto por defecto).
- Caché global habilitado.
- Event Emitter disponible para comunicación entre módulos.
- El sistema soporta matrices de respuestas y dependencias entre preguntas.

---

## Frontend asociado

Este backend está diseñado para trabajar con el frontend Angular de AzuayCare:

| Entorno     | URL                                      |
|-------------|------------------------------------------|
| Desarrollo  | `http://localhost:8087` o `4200`         |
| Producción  | `https://azuaycarev1.netlify.app`        |

---

## Despliegue sugerido

Opciones recomendadas:
- **Render**
- **Railway**
- **Fly.io**
- **Heroku**
- **VPS propio** (DigitalOcean, AWS, etc.)

Recomendaciones:
1. Usar una base de datos PostgreSQL gestionada.
2. Configurar correctamente las variables de entorno en el servicio de hosting.
3. Desactivar `synchronize` en producción.
4. Usar un `JWT_SECRET` fuerte.
5. Configurar HTTPS.
6. Revisar y ajustar la lista de orígenes CORS.

---

**AzuayCare** · Instituto Tecnológico del Azuay
