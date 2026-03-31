import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter<Prisma.PrismaClientKnownRequestError> {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    const { statusCode, message } = this.mapException(exception);

    this.logger.error(
      `${request.method} ${request.url} failed with Prisma code ${exception.code}: ${exception.message}`,
    );

    response.status(statusCode).json({
      statusCode,
      message,
      error:
        statusCode >= HttpStatus.INTERNAL_SERVER_ERROR
          ? 'Service Unavailable'
          : 'Bad Request',
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private mapException(exception: Prisma.PrismaClientKnownRequestError) {
    switch (exception.code) {
      case 'P2002':
        return {
          statusCode: HttpStatus.CONFLICT,
          message:
            'This record already exists or conflicts with existing data.',
        };
      case 'P2003':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'A related record is missing or invalid for this request.',
        };
      case 'P2025':
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'The requested record was not found.',
        };
      case 'P2021':
      case 'P2022':
        return {
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          message:
            'Database schema is outdated for this backend version. Run the Prisma migrations and restart the backend.',
        };
      default:
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Database request failed unexpectedly.',
        };
    }
  }
}
