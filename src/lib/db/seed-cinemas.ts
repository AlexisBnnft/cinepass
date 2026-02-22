import { Client } from "@libsql/client/web";

interface CinemaSeed {
  allocine_code: string;
  name: string;
  arrondissement: number;
  is_chain: boolean;
  latitude: number;
  longitude: number;
}

const CINEMAS: CinemaSeed[] = [
  { allocine_code: "C0060", name: "Pathé BNP Paribas", arrondissement: 2, is_chain: true, latitude: 48.8706, longitude: 2.3389 },
  { allocine_code: "C0013", name: "Luminor Hôtel-de-Ville", arrondissement: 4, is_chain: false, latitude: 48.8575, longitude: 2.3533 },
  { allocine_code: "C0071", name: "Écoles Cinéma Club", arrondissement: 5, is_chain: false, latitude: 48.8490, longitude: 2.3504 },
  { allocine_code: "W7504", name: "Épée de bois", arrondissement: 5, is_chain: false, latitude: 48.8428, longitude: 2.3497 },
  { allocine_code: "C0076", name: "Cinéma du Panthéon", arrondissement: 5, is_chain: false, latitude: 48.8480, longitude: 2.3424 },
  { allocine_code: "C0117", name: "Espace Saint-Michel", arrondissement: 5, is_chain: false, latitude: 48.8536, longitude: 2.3438 },
  { allocine_code: "C0020", name: "Filmothèque du Quartier Latin", arrondissement: 5, is_chain: false, latitude: 48.8498, longitude: 2.3436 },
  { allocine_code: "C0072", name: "Grand Action", arrondissement: 5, is_chain: false, latitude: 48.8497, longitude: 2.3531 },
  { allocine_code: "C0015", name: "Christine Cinéma Club", arrondissement: 6, is_chain: false, latitude: 48.8543, longitude: 2.3404 },
  { allocine_code: "C0041", name: "Nouvel Odéon", arrondissement: 6, is_chain: false, latitude: 48.8512, longitude: 2.3413 },
  { allocine_code: "C0096", name: "Le Saint-Germain-des-Prés", arrondissement: 6, is_chain: false, latitude: 48.8544, longitude: 2.3324 },
  { allocine_code: "C0083", name: "Studio des Ursulines", arrondissement: 6, is_chain: false, latitude: 48.8457, longitude: 2.3430 },
  { allocine_code: "C0095", name: "Les 3 Luxembourg", arrondissement: 6, is_chain: false, latitude: 48.8494, longitude: 2.3381 },
  { allocine_code: "C0108", name: "Élysées Lincoln", arrondissement: 8, is_chain: false, latitude: 48.8711, longitude: 2.3056 },
  { allocine_code: "C6336", name: "Publicis Cinémas", arrondissement: 8, is_chain: false, latitude: 48.8738, longitude: 2.2992 },
  { allocine_code: "C0009", name: "Balzac", arrondissement: 8, is_chain: false, latitude: 48.8741, longitude: 2.3019 },
  { allocine_code: "C0012", name: "Cinq Caumartin", arrondissement: 9, is_chain: false, latitude: 48.8755, longitude: 2.3296 },
  { allocine_code: "C0089", name: "Max Linder Panorama", arrondissement: 9, is_chain: false, latitude: 48.8714, longitude: 2.3450 },
  { allocine_code: "G02BG", name: "Pathé Palace", arrondissement: 9, is_chain: true, latitude: 48.8721, longitude: 2.3422 },
  { allocine_code: "C0023", name: "Le Brady", arrondissement: 10, is_chain: false, latitude: 48.8696, longitude: 2.3541 },
  { allocine_code: "C0024", name: "Pathé Les Fauvettes", arrondissement: 13, is_chain: true, latitude: 48.8359, longitude: 2.3510 },
  { allocine_code: "C0005", name: "L'Entrepôt", arrondissement: 14, is_chain: false, latitude: 48.8324, longitude: 2.3200 },
  { allocine_code: "C0153", name: "Chaplin Denfert", arrondissement: 14, is_chain: false, latitude: 48.8338, longitude: 2.3324 },
  { allocine_code: "C0037", name: "Pathé Alésia", arrondissement: 14, is_chain: true, latitude: 48.8280, longitude: 2.3271 },
  { allocine_code: "C0052", name: "Pathé Montparnos", arrondissement: 14, is_chain: true, latitude: 48.8425, longitude: 2.3217 },
  { allocine_code: "C0158", name: "Pathé Parnasse Premium", arrondissement: 14, is_chain: true, latitude: 48.8433, longitude: 2.3237 },
  { allocine_code: "C0025", name: "Les 7 Parnassiens", arrondissement: 14, is_chain: false, latitude: 48.8427, longitude: 2.3273 },
  { allocine_code: "W7515", name: "Chaplin Saint-Lambert", arrondissement: 15, is_chain: false, latitude: 48.8388, longitude: 2.3008 },
  { allocine_code: "C0161", name: "Pathé Convention", arrondissement: 15, is_chain: true, latitude: 48.8376, longitude: 2.2975 },
  { allocine_code: "C0116", name: "Pathé Aquaboulevard", arrondissement: 15, is_chain: true, latitude: 48.8310, longitude: 2.2785 },
  { allocine_code: "W7502", name: "Pathé Beaugrenelle", arrondissement: 15, is_chain: true, latitude: 48.8462, longitude: 2.2790 },
  { allocine_code: "C0004", name: "Cinéma des Cinéastes", arrondissement: 17, is_chain: false, latitude: 48.8836, longitude: 2.3266 },
  { allocine_code: "C0172", name: "Mac-Mahon", arrondissement: 17, is_chain: false, latitude: 48.8757, longitude: 2.2922 },
  { allocine_code: "P7517", name: "Les 7 Batignolles", arrondissement: 17, is_chain: false, latitude: 48.8839, longitude: 2.3195 },
  { allocine_code: "C0179", name: "Pathé Wepler", arrondissement: 18, is_chain: true, latitude: 48.8845, longitude: 2.3325 },
  { allocine_code: "C0189", name: "Pathé La Géode", arrondissement: 19, is_chain: true, latitude: 48.8955, longitude: 2.3872 },
  { allocine_code: "W7520", name: "Pathé La Villette", arrondissement: 19, is_chain: true, latitude: 48.8963, longitude: 2.3900 },
];

export async function seedCinemas(client: Client): Promise<void> {
  await client.batch(
    CINEMAS.map((cinema) => ({
      sql: "INSERT OR IGNORE INTO cinemas (allocine_code, name, arrondissement, is_chain, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?)",
      args: [cinema.allocine_code, cinema.name, cinema.arrondissement, cinema.is_chain ? 1 : 0, cinema.latitude, cinema.longitude],
    })),
    "write"
  );
}

export async function updateCinemaCoordinates(client: Client): Promise<void> {
  await client.batch(
    CINEMAS.map((cinema) => ({
      sql: "UPDATE cinemas SET latitude = ?, longitude = ? WHERE allocine_code = ?",
      args: [cinema.latitude, cinema.longitude, cinema.allocine_code],
    })),
    "write"
  );
}
