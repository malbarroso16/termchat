export class PrismaClient {
  $connect() { return Promise.resolve(); }
  $disconnect() { return Promise.resolve(); }
  $queryRaw() { return Promise.resolve(); }
}
