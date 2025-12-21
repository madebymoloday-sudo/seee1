import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | object;
    let field: string | undefined;

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      // Если сообщение - объект, извлекаем message поле или используем весь объект
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || exceptionResponse;
        field = responseObj.field;
      } else {
        message = exceptionResponse;
      }
    } else {
      // Логируем необработанные исключения для отладки
      const error = exception as Error;
      this.logger.error(
        `Unhandled exception: ${error?.message || 'Unknown error'}`,
        error?.stack,
        `${request.method} ${request.url}`,
      );
      message = process.env.NODE_ENV === 'production'
        ? 'Внутренняя ошибка сервера'
        : error?.message || 'Внутренняя ошибка сервера';
    }

    const responseBody: any = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      message,
    };

    if (field) {
      responseBody.field = field;
    }

    response.status(status).json(responseBody);
  }
}

