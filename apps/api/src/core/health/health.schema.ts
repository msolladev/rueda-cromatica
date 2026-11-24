import { instantSchema } from "@chromatic-wheel/domain";
import { z } from "zod";

/** What `GET /api/v1/health` answers while the API and its database work. */
export const healthSchema = z
  .object({
    status: z.literal("ok"),
    /** When the API checked it, in UTC. */
    checkedAt: instantSchema,
  })
  .meta({ id: "Health" });

/** See {@link healthSchema}. */
export type Health = z.infer<typeof healthSchema>;
