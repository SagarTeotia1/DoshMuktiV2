import type { FastifyRequest, FastifyReply } from 'fastify';
import { uploadProductImage, InvalidFileError } from './service';

export async function uploadImageHandler(req: FastifyRequest, reply: FastifyReply) {
  const file = await req.file();
  if (!file) return reply.code(400).send({ error: 'No file uploaded' });

  const buffer = await file.toBuffer();

  try {
    const urls = await uploadProductImage(buffer, file.mimetype);
    return reply.send(urls);
  } catch (err) {
    if (err instanceof InvalidFileError) return reply.code(400).send({ error: err.message });
    throw err;
  }
}
