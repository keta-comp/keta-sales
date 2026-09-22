import { singleBotToken } from "./single-bot.server";

export type ActiveBot = {
  token: string;
  business_id: string;
};

/** Single-bot mode: the one bot token comes from the server secret. */
export async function getActiveBot(businessId: string): Promise<ActiveBot | null> {
  try {
    return { token: singleBotToken(), business_id: businessId };
  } catch (error) {
    console.error("[bots]", error);
    return null;
  }
}
