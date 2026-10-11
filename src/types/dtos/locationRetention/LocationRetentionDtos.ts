// knk-web-api api/location-retention (KNG-80): orphaned Locations under review, the run log and
// the schedule. Mirrors Dtos/LocationRetentionDtos.cs.

/** Permission nodes (knk-web-api StaffPermissions, knk-plugin plugin.yml). */
export const LOCATION_RETENTION_NODES = {
    view: 'knk.admin.location.orphans',
    notify: 'knk.admin.location.orphans.notify',
    keep: 'knk.admin.location.orphans.keep',
    delete: 'knk.admin.location.orphans.delete',
    run: 'knk.admin.location.orphans.run',
    settings: 'knk.admin.location.retention',
    teleport: 'knk.admin.location.tp',
} as const;

export type LocationOrphanStatus = 'Open' | 'Kept' | 'Deleted' | 'Resolved';
export type LocationOrphanStatusFilter = 'open' | 'kept' | 'deleted' | 'resolved' | 'all';

export interface LocationOrphanPreviousDecisionDto {
    itemId: number;
    status: LocationOrphanStatus;
    decidedByUserId?: number | null;
    decidedByUsername?: string | null;
    decidedAt?: string | null;
    decisionNote?: string | null;
}

export interface LocationOrphanDto {
    id: number;
    locationId: number;
    status: LocationOrphanStatus;
    flaggedAt: string;
    flaggedByRunId?: number | null;
    lastSeenAt: string;
    name?: string | null;
    world?: string | null;
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    locationCreatedAt?: string | null;
    locationExists: boolean;
    decidedByUserId?: number | null;
    decidedByUsername?: string | null;
    decidedAt?: string | null;
    decisionNote?: string | null;
    resolvedReason?: string | null;
    previousDecision?: LocationOrphanPreviousDecisionDto | null;
}

export interface LocationOrphanPageDto {
    items: LocationOrphanDto[];
    totalCount: number;
    pageNumber: number;
    pageSize: number;
    openCount: number;
    keptCount: number;
}

export interface LocationOrphanDeleteResultDto {
    outcome: 'Deleted' | 'NoLongerOrphan';
    message: string;
    item: LocationOrphanDto;
}

export interface LocationRetentionRunDto {
    id: number;
    trigger: 'scheduled' | 'manual' | string;
    triggeredByUserId?: number | null;
    triggeredByUsername?: string | null;
    startedAt: string;
    finishedAt?: string | null;
    succeeded: boolean;
    error?: string | null;
    candidatesScanned: number;
    orphansFound: number;
    newOrphans: number;
    alreadyKnown: number;
    reflagged: number;
    resolved: number;
    durationMs: number;
    digestQueuedAt?: string | null;
}

export type LocationRetentionFrequency = 'Daily' | 'Weekly';

export interface LocationRetentionSettingsDto {
    scheduleEnabled: boolean;
    frequency: LocationRetentionFrequency;
    runDayOfWeek: string;
    /** HH:mm, server time. */
    runAtTime: string;
    gracePeriodDays: number;
    keptRecheckMonths: number;
    timeZone?: string | null;
    updatedAt?: string | null;
    updatedByUsername?: string | null;
}

export interface LocationRetentionStatusDto {
    settings: LocationRetentionSettingsDto;
    lastRun?: LocationRetentionRunDto | null;
    nextScheduledRunAt?: string | null;
    running: boolean;
    relations: string[];
    otherReferenceSources: string[];
}
