import { RoadClient } from '../roadClient';
import { Controllers, HttpMethod } from '../../utils';
import { RoadProfileUpsertDto } from '../../types/dtos/road/RoadDtos';

// Road navigation Phase 5: the client speaks the Phase 1.5 route table (kebab-case controllers,
// the search POST, the street road GET on the Streets controller).

describe('RoadClient', () => {
  const client = RoadClient.getInstance();
  let invokeSpy: jest.SpyInstance;

  beforeEach(() => {
    invokeSpy = jest.spyOn(client as any, 'invokeServiceCall').mockResolvedValue(null);
  });

  afterEach(() => {
    invokeSpy.mockRestore();
  });

  it('uses the kebab-case road controllers', () => {
    expect(Controllers.RoadProfiles).toBe('road-profiles');
    expect(Controllers.RoadTiles).toBe('road-tiles');
    expect(Controllers.RoadEdges).toBe('road-edges');
    expect(Controllers.RoadNetwork).toBe('road-network');
    expect(Controllers.RoadNodes).toBe('road-nodes');
  });

  it('lists, reads, creates, updates and deletes profiles under api/road-profiles', async () => {
    await client.getProfiles();
    expect(invokeSpy).toHaveBeenCalledWith(null, '', Controllers.RoadProfiles, HttpMethod.Get);

    await client.getProfile(3);
    expect(invokeSpy).toHaveBeenCalledWith(null, '3', Controllers.RoadProfiles, HttpMethod.Get);

    const profile: RoadProfileUpsertDto = {
      name: 'Kardenna main street', roadClass: 'Main', costMultiplier: 1, materials: [],
      widthMin: 3, widthMax: 7, sampleCount: 0, enabled: true, scopeTownIds: null, stats: null,
    };
    await client.createProfile(profile);
    expect(invokeSpy).toHaveBeenCalledWith(profile, '', Controllers.RoadProfiles, HttpMethod.Post);

    await client.updateProfile(3, profile);
    expect(invokeSpy).toHaveBeenCalledWith(profile, '3', Controllers.RoadProfiles, HttpMethod.Put);

    await client.deleteProfile(3);
    expect(invokeSpy).toHaveBeenCalledWith(null, '3', Controllers.RoadProfiles, HttpMethod.Delete);
  });

  it('lists the tiles of a world and reads one tile graph', async () => {
    await client.getTiles('world');
    expect(invokeSpy).toHaveBeenCalledWith({ world: 'world' }, '', Controllers.RoadTiles, HttpMethod.Get);

    await client.getTileGraph('my world', -1, 2);
    expect(invokeSpy).toHaveBeenCalledWith(null, 'my%20world/-1/2/graph', Controllers.RoadTiles, HttpMethod.Get);
  });

  it('reads the network meta of a world', async () => {
    await client.getMeta('world');
    expect(invokeSpy).toHaveBeenCalledWith({ world: 'world' }, 'meta', Controllers.RoadNetwork, HttpMethod.Get);
  });

  it('searches edges with POST api/road-edges/search and the string filters', async () => {
    const query = { pageNumber: 2, pageSize: 50, sortBy: 'length' as const, sortDescending: true, filters: { world: 'world', unlabelled: 'true' as const } };
    await client.searchEdges(query);
    expect(invokeSpy).toHaveBeenCalledWith(query, 'search', Controllers.RoadEdges, HttpMethod.Post);
  });

  it('updates and deletes an edge under api/road-edges/{id}', async () => {
    await client.updateEdge(42, { streetId: 7, propagate: true });
    expect(invokeSpy).toHaveBeenCalledWith({ streetId: 7, propagate: true }, '42', Controllers.RoadEdges, HttpMethod.Put);

    await client.deleteEdge(42);
    expect(invokeSpy).toHaveBeenCalledWith(null, '42', Controllers.RoadEdges, HttpMethod.Delete);
  });

  it('updates a node under api/road-nodes/{id}', async () => {
    await client.updateNode(9, { name: 'Market', locked: false });
    expect(invokeSpy).toHaveBeenCalledWith({ name: 'Market', locked: false }, '9', Controllers.RoadNodes, HttpMethod.Put);
  });

  it("reads a street's road from api/Streets/{id}/road", async () => {
    await client.getStreetRoad(5);
    expect(invokeSpy).toHaveBeenCalledWith(null, '5/road', Controllers.Streets, HttpMethod.Get);
  });
});
