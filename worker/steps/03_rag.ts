// worker/steps/04-agent-tools.ts
import Groq from "groq-sdk";
import { checkOrderStatus } from "../tools/check_order";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

export async function processAgentWithTools(ticketId: string, ticketContent: string, customerEmail: string) {
    console.log(`🤖 [Agent Step] Starting tool-calling loop for ticket: ${ticketId}`);

    // 1. Define the conversation history array
    const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
        {
            role: "system",
            content: "You are a helpful customer support agent. If the user asks about an order, use your tools to look it up. The customer's email is " + customerEmail,
        },
        {
            role: "user",
            content: ticketContent,
        },
    ];

    // 2. Define the Tool Schema
    const tools: Groq.Chat.Completions.ChatCompletionTool[] = [
        {
            type: "function",
            function: {
                name: "check_order_status",
                description: "Find an order status by the customer's email address.",
                parameters: {
                    type: "object",
                    properties: {
                        email: {
                            type: "string",
                            description: "The customer's email address",
                        },
                    },
                    required: ["email"],
                },
            },
        },
    ];

    // 3. Make the initial call to Groq
    const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: messages,
        tools: tools,
        tool_choice: "auto", // Lets the model decide if it needs the tool
    });

    const responseMessage = completion.choices[0].message;

    // 4. Intercept: Did the LLM ask to use a tool?
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        console.log(`⏸️ LLM paused generation to use a tool:`, responseMessage.tool_calls[0].function.name);

        // Append the LLM's tool request to the conversation history
        messages.push(responseMessage);

        for (const toolCall of responseMessage.tool_calls) {
            if (toolCall.function.name === "check_order_status") {
                // Parse the arguments the LLM extracted from the user's prompt
                const args = JSON.parse(toolCall.function.arguments);

                // 5. Execute our Node.js function
                const toolResult = await checkOrderStatus(args.email);

                // 6. Feed the result back into the conversation history
                messages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: toolResult,
                });
            }
        }

        console.log(`🔁 Sending tool results back to Groq for final answer...`);

        // 7. Call Groq a second time so it can read the tool result and answer the user
        const finalCompletion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: messages,
        });

        return finalCompletion.choices[0].message.content;
    }

    // If no tools were needed, just return the standard text response
    return responseMessage.content;
}