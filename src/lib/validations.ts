import { z } from "zod";

export const TicketSchema = z.object({
    email: z.email(),
    content: z
        .string()
        .min(5, "Message must be at least 5 characters.")
        .max(5000, "Message is too long."),
});

export type TicketInput = z.infer<typeof TicketSchema>;