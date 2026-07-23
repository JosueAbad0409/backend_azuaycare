import {ExceptionFilter,Catch,ArgumentsHost,HttpException,HttpStatus,Logger,} from '@nestjs/common';
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

        const message =
        exception instanceof HttpException
            ? exception.getResponse()
            : 'Error interno del servidor';

        // Registramos el error real en la consola del servidor para depuración
        this.logger.error(
        `HTTP Status: ${status} Error Message: ${JSON.stringify(message)}`,
        exception instanceof Error ? exception.stack : '',
        );

        // Devolvemos una respuesta limpia al cliente
        response.status(status).json({
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        message: status === HttpStatus.INTERNAL_SERVER_ERROR ? 'Error interno del servidor' : message,
        });
    }
}