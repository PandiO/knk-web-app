import type { MockApi } from '../support/mockApi';
import type { PlayerModerationResultDto, UserByUuidDto } from '../../src/types/dtos/userManagement/UserProfileSummaryDtos';
import type { MapPlayersDto } from '../../src/types/dtos/map/MapDtos';
import { defaultJoe, mapConfigLive, mockMapOn, ownerPandi, playersSnapshot } from './map';

/**
 * The player context panel on the overview map (PandiO/knk-workspace#743): the live players layer on with Pandi and
 * Joe, Joe's account behind his UUID (`GET api/Users/uuid/{uuid}`, user 42) and the moderation endpoints the profile
 * page uses (`PUT api/Users/42/freeze` and `/unfreeze`, `POST api/Users/42/kick` and `/ban`). Freezing and unfreezing
 * change what the next account read says, as the API would.
 */

export const JOE_USER_ID = 42;

export interface FakeModeration {
  /** `METHOD path` and body of each moderation write, in order. */
  writes: { action: string; body: unknown }[];
}

export function mockMapModeration(api: MockApi): FakeModeration {
  mockMapOn(api, mapConfigLive);
  api.on<MapPlayersDto>('GET', 'Map/players', {
    status: 200, body: playersSnapshot([ownerPandi, defaultJoe]), headers: { 'Cache-Control': 'no-store' },
  });
  const fake: FakeModeration = { writes: [] };
  let frozen: { reason: string } | null = null;
  api.on<UserByUuidDto>('GET', `Users/uuid/${defaultJoe.uuid}`, () => ({
    body: { id: JOE_USER_ID, username: 'Joe', uuid: defaultJoe.uuid, isFrozen: frozen !== null, frozenReason: frozen?.reason ?? null },
  }));
  api.on('PUT', `Users/${JOE_USER_ID}/freeze`, ({ body }) => {
    fake.writes.push({ action: 'freeze', body });
    frozen = { reason: (body as { reason: string }).reason };
    return { status: 204 };
  });
  api.on('PUT', `Users/${JOE_USER_ID}/unfreeze`, ({ body }) => {
    fake.writes.push({ action: 'unfreeze', body });
    frozen = null;
    return { status: 204 };
  });
  api.on<PlayerModerationResultDto>('POST', `Users/${JOE_USER_ID}/kick`, ({ body }) => {
    fake.writes.push({ action: 'kick', body });
    return { status: 202, body: { actionId: `kick-${fake.writes.length}`, userId: JOE_USER_ID, gameServers: 1 } };
  });
  api.on<PlayerModerationResultDto>('POST', `Users/${JOE_USER_ID}/ban`, ({ body }) => {
    fake.writes.push({ action: 'ban', body });
    return { status: 202, body: { actionId: `ban-${fake.writes.length}`, userId: JOE_USER_ID, gameServers: 1 } };
  });
  return fake;
}
