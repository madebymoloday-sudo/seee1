import { HttpException, HttpStatus } from '@nestjs/common';

export class LavaApiException extends HttpException {
  constructor(
    message: string,
    statusCode: HttpStatus = HttpStatus.BAD_GATEWAY,
  ) {
    super(
      {
        statusCode,
        message: `Lava API Error: ${message}`,
        error: 'Lava API Integration Error',
      },
      statusCode,
    );
  }
}

