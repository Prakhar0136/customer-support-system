import { NextRequest, NextResponse } from "next/server";
import { TicketSchema } from "@/lib/validations";
import { supabaseAdmin } from "@/lib/db/supabase-admin";
import { supportQueue } from "@/lib/queue/config";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const result = TicketSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                {
                    success: false,
                    errors: result.error.flatten(),
                },
                { status: 400 }
            );
        }

        const { email, content } = result.data;

        // Check if customer already exists
        const { data: existingCustomer, error: customerError } = await supabaseAdmin
            .from("customers")
            .select("id")
            .eq("email", email)
            .maybeSingle();

        if (customerError) {
            console.error(customerError);

            return NextResponse.json(
                {
                    success: false,
                    message: "Failed to query customer.",
                },
                { status: 500 }
            );
        }

        let customerId: string;

        // Create customer if not found
        if (!existingCustomer) {
            const { data: newCustomer, error: createCustomerError } =
                await supabaseAdmin
                    .from("customers")
                    .insert({
                        email,
                    })
                    .select("id")
                    .single();

            if (createCustomerError) {
                console.error(createCustomerError);

                return NextResponse.json(
                    {
                        success: false,
                        message: "Failed to create customer.",
                    },
                    { status: 500 }
                );
            }

            customerId = newCustomer.id;
        } else {
            customerId = existingCustomer.id;
        }

        // Create ticket
        const { data: ticket, error: ticketError } = await supabaseAdmin
            .from("tickets")
            .insert({
                customer_id: customerId,
                content,
                status: "pending",
            })
            .select()
            .single();

        if (ticketError) {
            console.error(ticketError);

            return NextResponse.json(
                {
                    success: false,
                    message: "Failed to create ticket.",
                },
                { status: 500 }
            );
        }

        // Fire-and-forget: enqueue the ticket for background processing
        await supportQueue.add("process-ticket", {
            ticketId: ticket.id,
        });

        return NextResponse.json(
            {
                success: true,
                message: "Ticket received and queued for processing.",
                ticketId: ticket.id,
            },
            { status: 200 }
        );

    } catch (error) {
        console.error(error);

        return NextResponse.json(
            {
                success: false,
                message: "Invalid request body.",
            },
            { status: 400 }
        );
    }
}