export type TicketStatus = 'pending' | 'escalated' | 'needs_review' | 'resolved';

export interface Customer {
    id: string;
    email: string;
    name?: string;
    created_at?: string;
}

export interface Ticket {
    id: string;
    customer_id: string;
    content: string;
    status: TicketStatus;
    agent_draft?: string | null;
    confidence?: number | null;
    sentiment?: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface KnowledgeBaseItem {
    id: string;
    title: string;
    content: string;
    category?: string;
    embedding?: number[] | null;
    created_at?: string;
}