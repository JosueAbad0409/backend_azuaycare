// src/filters/global-exception.filter.ts

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Extraemos el mensaje real, sin volver a anidarlo dentro de otro objeto.
    let message: string | string[] = 'Error interno del servidor';

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        // Caso: throw new BadRequestException('texto plano')
        message = exceptionResponse;
      } else if (exceptionResponse && typeof exceptionResponse === 'object') {
        // Caso: ValidationPipe (class-validator) o
        // throw new BadRequestException('texto') internamente devuelve
        // { statusCode, message, error }. Tomamos solo el "message" real.
        const inner = (exceptionResponse as any).message;
        message = inner ?? exception.message ?? message;
      }
    }

    // Registramos el error real en la consola del servidor para depuración
    this.logger.error(
      `HTTP Status: ${status} Error Message: ${JSON.stringify(message)}`,
      exception instanceof Error ? exception.stack : '',
    );

    // Devolvemos una respuesta limpia y plana al cliente
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message:
        status === HttpStatus.INTERNAL_SERVER_ERROR
          ? (exception as any).message || 'Error interno del servidor'
          : message,
    });
  }
}