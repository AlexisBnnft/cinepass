import { createClient, Client } from "@libsql/client/web";
import { SCHEMA } from "./schema";
import { seedCinemas, updateCinemaCoordinates } from "./seed-cinemas";

let _client: Client | null = null;
let _initialized = false;

function getClient(): Client {
  if (!_client) {
    _client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return _client;
}

export async function getDb(): Promise<Client> {
  const client = getClient();
  if (!_initialized) {
    await client.executeMultiple(SCHEMA);
    const result = await client.execute("SELECT COUNT(*) as count FROM cinemas");
    if ((result.rows[0].count as number) === 0) {
      await seedCinemas(client);
    } else {
      const nullCoords = await client.execute("SELECT COUNT(*) as count FROM cinemas WHERE latitude IS NULL");
      if ((nullCoords.rows[0].count as number) > 0) {
        await updateCinemaCoordinates(client);
      }
    }
    _initialized = true;
  }
  return client;
}
