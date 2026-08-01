import { prisma } from "./prisma";

/**
 * Dynamically retrieves an API key or configuration value from the database.
 * Falls back to process.env if the key is not defined in the database.
 * 
 * @param key The config key name (e.g., "GEMINI_API_KEY")
 * @param defaultValue Optional fallback value
 */
export async function getApiKey(key: string, defaultValue?: string): Promise<string> {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: key.toUpperCase().trim() },
    });
    if (config) {
      return config.value;
    }
  } catch (error) {
    console.error(`Failed to fetch dynamic API key [${key}] from DB:`, error);
  }
  return defaultValue || process.env[key] || "";
}
