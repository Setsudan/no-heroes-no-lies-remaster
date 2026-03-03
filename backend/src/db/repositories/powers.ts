import { dbPool } from "../pool";
import { Power } from "../schema";

export async function loadPowers(): Promise<Power[]> {
  const result = await dbPool.query<Power>("SELECT * FROM powers ORDER BY name ASC");
  return result.rows;
}

