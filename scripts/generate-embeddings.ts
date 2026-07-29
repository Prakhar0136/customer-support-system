// scripts/generate-embeddings.ts
import "dotenv/config";
import { pipeline } from "@xenova/transformers";
import { supabase } from "../src/lib/db/supabase";

async function generateEmbeddings() {
    console.log("🤖 Loading local embedding model (Xenova/all-MiniLM-L6-v2)...");

    // 1. Initialize the feature-extraction pipeline (downloads model weights on 1st run ~80MB)
    const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");

    console.log("📚 Fetching articles from Supabase...");

    // 2. Fetch knowledge base articles from Postgres
    const { data: articles, error } = await supabase
        .from("knowledge_base")
        .select("id, title, content");

    if (error || !articles) {
        console.error("❌ Error fetching articles from Supabase:", error);
        process.exit(1);
    }

    console.log(`Found ${articles.length} articles to process.\n`);

    // 3. Process each article
    for (const article of articles) {
        console.log(`⚡ Generating vector for: "${article.title}"...`);

        // Combine title and content for richer semantic search context
        const textToEmbed = `${article.title}: ${article.content}`;

        // Generate normalized 384-dimensional output vector
        const output = await extractor(textToEmbed, { pooling: "mean", normalize: true });

        // Convert Float32Array to standard JavaScript Array
        const embedding = Array.from(output.data);

        // 4. Update the article row in Supabase with the vector
        const { error: updateError } = await supabase
            .from("knowledge_base")
            .update({ embedding })
            .eq("id", article.id);

        if (updateError) {
            console.error(`❌ Failed to update article "${article.title}":`, updateError.message);
        } else {
            console.log(`✅ Saved vector [${embedding.length} dims] for "${article.title}"`);
        }
    }

    console.log("\n🎉 All knowledge base articles successfully embedded!");
}

generateEmbeddings().catch((err) => {
    console.error("Fatal Error:", err);
    process.exit(1);
});