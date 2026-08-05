export interface AuditLogEntry {
  id: string;
  created_at: string;
  actor_type: string;
  actor_id: string | null;
  entity_type: string;
  entity_id: string | null;
  action: string;
  note: string | null;
}

export interface AdminLogsParams {
  entity_type?: string;
  action?: string;
  cursor?: string;
  limit?: number;
}
