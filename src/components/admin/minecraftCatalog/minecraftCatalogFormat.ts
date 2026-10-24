// Small display helpers shared by the Minecraft catalogue admin cards (KNG-200 phase 3).

export const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

export const scanStatusClass = (status: string): string => {
  switch (status) {
    case 'Completed':
      return 'bg-green-100 text-green-800';
    case 'Failed':
      return 'bg-red-100 text-red-800';
    case 'Requested':
      return 'bg-gray-200 text-gray-800';
    default:
      return 'bg-blue-100 text-blue-800';
  }
};

/** `ItemBlueprint.IconMaterialRefId` x 3, `Category.IconMaterialRefId` x 1 */
export const describeReferences = (references: Record<string, number> | null | undefined): string => {
  const entries = Object.entries(references ?? {}).filter(([, count]) => count > 0);
  if (entries.length === 0) return 'Nothing';
  return entries.map(([referrer, count]) => `${referrer} × ${count}`).join(', ');
};

export const sumCounts = (counts: Record<string, number> | null | undefined): number =>
  Object.values(counts ?? {}).reduce((sum, count) => sum + count, 0);
