import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../logger/pino';

export function errorHandler(error: FastifyError, req: FastifyRequest, reply: FastifyReply) {
  if (error.validation) {
    return reply.code(400).send({ error: 'Invalid input', details: error.validation });
  }

  logger.error({ err: error, path: req.url, method: req.method }, 'Unhandled request error');

  const status = error.statusCode ?? 500;
  reply.code(status).send({ error: status === 500 ? 'Internal server error' : error.message });
}
