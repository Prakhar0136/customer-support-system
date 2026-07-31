// worker/tools/check_order.ts

export async function checkOrderStatus(email: string): Promise<string> {
    console.log(`🛠️ [Tool Execution] Database lookup for email: ${email}`);

    // Fake network delay to simulate a real database query
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // In the real world, you would query Postgres or Stripe here.
    return "Order shipped";
}