import { detailTrail, formTrail, trailTo } from '../breadcrumbs';

const labelFor = (name: string) => ({ town: 'Town', gatestructure: 'Gate structure' } as Record<string, string>)[name.toLowerCase()] ?? name;

describe('trailTo (#177 link 2)', () => {
  it('leads back to a dashboard type', () => {
    expect(trailTo('/dashboard/Town?page=2', labelFor)).toEqual([
      { label: 'Dashboard', to: '/dashboard' },
      { label: 'Town', to: '/dashboard/Town?page=2' },
    ]);
    expect(trailTo('/dashboard', labelFor)).toEqual([{ label: 'Dashboard', to: '/dashboard' }]);
  });

  it('leads back to a detail page, naming the entity when it is known', () => {
    expect(trailTo('/display/Town/4?returnTo=%2Fdashboard%2FTown', labelFor)).toEqual([
      { label: 'Dashboard', to: '/dashboard' },
      { label: 'Town', to: '/dashboard/Town' },
      { label: '#4', to: '/display/Town/4?returnTo=%2Fdashboard%2FTown' },
    ]);
    expect(trailTo('/display/town/4', labelFor, { entityTypeName: 'Town', entityId: '4', entityLabel: 'Cinix' })[2])
      .toEqual({ label: 'Cinix', to: '/display/town/4' });
  });

  it('leads back to the Entity setup page and to other pages', () => {
    expect(trailTo('/forms/GateStructure', labelFor)).toEqual([
      { label: 'Entity setup', to: '/forms' },
      { label: 'Gate structure', to: '/forms/GateStructure' },
    ]);
    expect(trailTo('/admin/lootboxes', labelFor)).toEqual([{ label: 'Back', to: '/admin/lootboxes' }]);
  });

  it('gives no crumbs for a missing or unsafe returnTo', () => {
    expect(trailTo(null, labelFor)).toEqual([]);
    expect(trailTo('https://evil.example/dashboard', labelFor)).toEqual([]);
    expect(trailTo('//evil.example', labelFor)).toEqual([]);
  });
});

describe('formTrail', () => {
  it('ends in "Edit {name}", or the id until the name loaded', () => {
    expect(formTrail({ returnTo: '/dashboard/Town', entityTypeName: 'Town', entityId: '4', entityLabel: 'Cinix', labelFor })).toEqual([
      { label: 'Dashboard', to: '/dashboard' },
      { label: 'Town', to: '/dashboard/Town' },
      { label: 'Edit Cinix' },
    ]);
    expect(formTrail({ returnTo: '/dashboard/Town', entityTypeName: 'Town', entityId: '4', labelFor }).slice(-1)[0]).toEqual({ label: 'Edit #4' });
  });

  it('ends in "New {Type}" and falls back to the Entity setup page without returnTo', () => {
    expect(formTrail({ returnTo: null, entityTypeName: 'Town', labelFor })).toEqual([
      { label: 'Entity setup', to: '/forms' },
      { label: 'Town', to: '/forms/Town' },
      { label: 'New Town' },
    ]);
  });
});

describe('detailTrail', () => {
  it('goes through returnTo, else the dashboard on the type', () => {
    expect(detailTrail({ returnTo: null, entityTypeName: 'Town', entityLabel: 'Cinix', labelFor })).toEqual([
      { label: 'Dashboard', to: '/dashboard' },
      { label: 'Town', to: '/dashboard/Town' },
      { label: 'Cinix' },
    ]);
    expect(detailTrail({ returnTo: '/admin/users/3', entityTypeName: 'Town', entityLabel: 'Cinix', labelFor })).toEqual([
      { label: 'Back', to: '/admin/users/3' },
      { label: 'Cinix' },
    ]);
  });
});
