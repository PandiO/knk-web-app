import { GateDoorOpenState, HealthDisplayMode, GateInfoDisplayMode } from './GateDoorDto';

/**
 * Request body for PATCH /api/GateStructures/{id}/overrides - sets/clears the structure-level
 * cascading overrides (decision 5.0-B, docs/features/gate-structure-animation/
 * GATESTRUCTURE_QOL_IMPLEMENTATION_PLAN.md item 5). A field left undefined is NOT changed; to
 * clear an override explicitly, set its matching "clear" flag instead, since "field absent" and
 * "field explicitly cleared" both serialize the same way as undefined/null.
 */
export interface GateStructureOverridesUpdateDto {
  isActiveOverride?: boolean | null;
  clearIsActiveOverride?: boolean;

  canRespawnOverride?: boolean | null;
  clearCanRespawnOverride?: boolean;

  isDestroyedOverride?: boolean | null;
  clearIsDestroyedOverride?: boolean;

  isInvincibleOverride?: boolean | null;
  clearIsInvincibleOverride?: boolean;

  openedStateOverride?: GateDoorOpenState | null;
  clearOpenedStateOverride?: boolean;

  allowPassThroughOverride?: boolean | null;
  clearAllowPassThroughOverride?: boolean;

  passThroughDurationSecondsOverride?: number | null;
  clearPassThroughDurationSecondsOverride?: boolean;

  showHealthDisplayOverride?: boolean | null;
  clearShowHealthDisplayOverride?: boolean;

  healthDisplayModeOverride?: HealthDisplayMode | null;
  clearHealthDisplayModeOverride?: boolean;

  healthDisplayYOffsetOverride?: number | null;
  clearHealthDisplayYOffsetOverride?: boolean;

  gateNameDisplayModeOverride?: GateInfoDisplayMode | null;
  clearGateNameDisplayModeOverride?: boolean;

  statusDisplayModeOverride?: GateInfoDisplayMode | null;
  clearStatusDisplayModeOverride?: boolean;

  allowContinuousDamageOverride?: boolean | null;
  clearAllowContinuousDamageOverride?: boolean;

  continuousDamageMultiplierOverride?: number | null;
  clearContinuousDamageMultiplierOverride?: boolean;
}
