import Fastify from "fastify";

export async function buildServer() {
  const app = Fastify({ logger: true });

  app.get("/health", async () => ({ ok: true }));

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = await buildServer();
  await app.listen({ port: 8787, host: "0.0.0.0" });
}
