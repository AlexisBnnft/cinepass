import { Client } from "@libsql/client";

interface CinemaSeed {
  allocine_code: string;
  name: string;
  arrondissement: number;
  is_chain: boolean;
}

const CINEMAS: CinemaSeed[] = [
  { allocine_code: "C0060", name: "Pathé BNP Paribas", arrondissement: 2, is_chain: true },
  { allocine_code: "C0013", name: "Luminor Hôtel-de-Ville", arrondissement: 4, is_chain: false },
  { allocine_code: "C0071", name: "Écoles Cinéma Club", arrondissement: 5, is_chain: false },
  { allocine_code: "W7504", name: "Épée de bois", arrondissement: 5, is_chain: false },
  { allocine_code: "C0076", name: "Cinéma du Panthéon", arrondissement: 5, is_chain: false },
  { allocine_code: "C0117", name: "Espace Saint-Michel", arrondissement: 5, is_chain: false },
  { allocine_code: "C0020", name: "Filmothèque du Quartier Latin", arrondissement: 5, is_chain: false },
  { allocine_code: "C0072", name: "Grand Action", arrondissement: 5, is_chain: false },
  { allocine_code: "C0015", name: "Christine Cinéma Club", arrondissement: 6, is_chain: false },
  { allocine_code: "C0041", name: "Nouvel Odéon", arrondissement: 6, is_chain: false },
  { allocine_code: "C0096", name: "Le Saint-Germain-des-Prés", arrondissement: 6, is_chain: false },
  { allocine_code: "C0083", name: "Studio des Ursulines", arrondissement: 6, is_chain: false },
  { allocine_code: "C0095", name: "Les 3 Luxembourg", arrondissement: 6, is_chain: false },
  { allocine_code: "C0108", name: "Élysées Lincoln", arrondissement: 8, is_chain: false },
  { allocine_code: "C6336", name: "Publicis Cinémas", arrondissement: 8, is_chain: false },
  { allocine_code: "C0009", name: "Balzac", arrondissement: 8, is_chain: false },
  { allocine_code: "C0012", name: "Cinq Caumartin", arrondissement: 9, is_chain: false },
  { allocine_code: "C0089", name: "Max Linder Panorama", arrondissement: 9, is_chain: false },
  { allocine_code: "G02BG", name: "Pathé Palace", arrondissement: 9, is_chain: true },
  { allocine_code: "C0023", name: "Le Brady", arrondissement: 10, is_chain: false },
  { allocine_code: "C0024", name: "Pathé Les Fauvettes", arrondissement: 13, is_chain: true },
  { allocine_code: "C0005", name: "L'Entrepôt", arrondissement: 14, is_chain: false },
  { allocine_code: "C0153", name: "Chaplin Denfert", arrondissement: 14, is_chain: false },
  { allocine_code: "C0037", name: "Pathé Alésia", arrondissement: 14, is_chain: true },
  { allocine_code: "C0052", name: "Pathé Montparnos", arrondissement: 14, is_chain: true },
  { allocine_code: "C0158", name: "Pathé Parnasse Premium", arrondissement: 14, is_chain: true },
  { allocine_code: "C0025", name: "Les 7 Parnassiens", arrondissement: 14, is_chain: false },
  { allocine_code: "W7515", name: "Chaplin Saint-Lambert", arrondissement: 15, is_chain: false },
  { allocine_code: "C0161", name: "Pathé Convention", arrondissement: 15, is_chain: true },
  { allocine_code: "C0116", name: "Pathé Aquaboulevard", arrondissement: 15, is_chain: true },
  { allocine_code: "W7502", name: "Pathé Beaugrenelle", arrondissement: 15, is_chain: true },
  { allocine_code: "C0004", name: "Cinéma des Cinéastes", arrondissement: 17, is_chain: false },
  { allocine_code: "C0172", name: "Mac-Mahon", arrondissement: 17, is_chain: false },
  { allocine_code: "P7517", name: "Les 7 Batignolles", arrondissement: 17, is_chain: false },
  { allocine_code: "C0179", name: "Pathé Wepler", arrondissement: 18, is_chain: true },
  { allocine_code: "C0189", name: "Pathé La Géode", arrondissement: 19, is_chain: true },
  { allocine_code: "W7520", name: "Pathé La Villette", arrondissement: 19, is_chain: true },
];

export async function seedCinemas(client: Client): Promise<void> {
  await client.batch(
    CINEMAS.map((cinema) => ({
      sql: "INSERT OR IGNORE INTO cinemas (allocine_code, name, arrondissement, is_chain) VALUES (?, ?, ?, ?)",
      args: [cinema.allocine_code, cinema.name, cinema.arrondissement, cinema.is_chain ? 1 : 0],
    })),
    "write"
  );
}
