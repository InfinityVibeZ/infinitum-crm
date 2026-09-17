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
    const config = await prisma.systemConfig.findFirst({
      where: { key: key.toUpperCase().trim() },
    });
    if (config) {
      if (typeof config.value === 'string') return config.value;
      if (config.value !== null && config.value !== undefined) return String(config.value);
    }
  } catch (error) {
    console.error(`Failed to fetch dynamic API key [${key}] from DB:`, error);
  }
  return defaultValue || process.env[key] || "";
}
