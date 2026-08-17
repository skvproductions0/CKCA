export class AppError extends Error {
  constructor(
    message: string,
    public code: string = 'UNKNOWN_ERROR',
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function handlePrismaError(error: unknown): AppError {
  if (error && typeof error === 'object' && 'code' in error) {
    const prismaError = error as { code: string; meta?: { target?: string[] } };
    switch (prismaError.code) {
      case 'P2002': {
        const target = prismaError.meta?.target?.join(', ') || 'field';
        return new AppError(
          `A record with this ${target} already exists.`,
          'DUPLICATE_ENTRY',
          409
        );
      }
      case 'P2025':
        return new AppError('The requested record was not found.', 'NOT_FOUND', 404);
      case 'P2003':
        return new AppError('This record is linked to other data and cannot be deleted.', 'FOREIGN_KEY', 400);
      default:
        break;
    }
  }
  if (error instanceof AppError) return error;
  if (error instanceof Error) {
    return new AppError(error.message, 'INTERNAL_ERROR', 500);
  }
  return new AppError('An unexpected error occurred.', 'INTERNAL_ERROR', 500);
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export function success<T>(data: T): ApiResponse<T> {
  return { success: true, data };
}

export function failure(error: string, code = 'ERROR'): ApiResponse {
  return { success: false, error, code };
}
