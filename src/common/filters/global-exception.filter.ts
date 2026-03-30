import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { Response } from 'express';

interface ValidationError {
  field: string;
  message: string[] | string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: ValidationError[] = [];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object') {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || 'An error occurred';
        
        // Handle validation errors
        if (status === HttpStatus.BAD_REQUEST && Array.isArray(responseObj.message)) {
          errors = responseObj.message.map((err: any) => ({
            field: err.property,
            message: Object.values(err.constraints || {}).join(', '),
          }));
        }
      } else {
        message = exceptionResponse;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      
      // Handle MongoDB validation errors
      if (exception.name === 'ValidationError') {
        const mongoError = exception as any;
        errors = Object.entries(mongoError.errors || {}).map(([field, err]: [string, any]) => ({
          field,
          message: err.message,
        }));
        status = HttpStatus.BAD_REQUEST;
      }
    }

    response.status(status).json({
      success: false,
      status,
      message,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    });
  }
}
