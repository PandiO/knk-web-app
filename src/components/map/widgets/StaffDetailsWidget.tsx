import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import DisplayWizard from '../../DisplayWizard/DisplayWizard';
import { buildReturnTo, displayPath } from '../../../utils/returnTo';

export interface StaffDetailsProps {
  /** The display configuration's entity type, e.g. `Structure`, `GateStructure`, `Town`. */
  entityType: string;
  id: number;
}

/**
 * The staff "Details" of a map panel (PandiO/knk-workspace#740; OVERVIEW_MAP_DESIGN § 4 item 5, § 5 rule 10, § 6.3.3,
 * O09, O16, A17): the type's default display configuration in compact form, read-only with links, and "Open full
 * page" to the detail page, where changes are made. Loaded on demand (staffDetailsRegistrations), so the map page of
 * a viewer without the node neither downloads nor runs it.
 */
const StaffDetails: React.FC<StaffDetailsProps> = ({ entityType, id }) => {
  const location = useLocation();
  return (
    <section aria-label="Details" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-fg">Details</h3>
        <Link to={displayPath(entityType, id, buildReturnTo(location))} className="text-sm font-medium text-primary underline">
          Open full page
        </Link>
      </div>
      <DisplayWizard entityTypeName={entityType} entityId={id} compact />
    </section>
  );
};

export default StaffDetails;
