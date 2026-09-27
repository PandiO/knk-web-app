// Mirrors knk-web-api's GET/PUT api/AuditLogRetentionConfiguration
// (AuditLogRetentionConfigurationDtos.cs): how long audit log entries and private message log
// entries (docs/specs/private-messages/DESIGN.md §3.1) are kept before the daily cleanup.

export interface AuditLogRetentionConfigurationDto {
  retentionDays: number;
  privateMessageRetentionDays: number;
  updatedAt: string;
}

export interface UpdateAuditLogRetentionConfigurationDto {
  retentionDays: number;
  /** Left out = unchanged. */
  privateMessageRetentionDays?: number;
}
