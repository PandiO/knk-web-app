export interface DomainDto {
    id?: number;
    name: string;
    description: string;
    createdAt?: string;
    allowEntry?: boolean;
    allowExit?: boolean;
    wgRegionId: string;
    locationId?: number;
    parentDomainId?: number;
    parentDomain?: ParentDomainDto;
}

export interface ParentDomainDto {
    id: number;
    name: string;
    parentDomainId?: number;
    parentDomain?: ParentDomainDto;
    domainSubType: string;
}

// Concrete Domain subtype (Town/District/Structure/...) - lets a picker show "Ironhaven (Town)"
// rather than an ambiguous bare name (docs/specs/items/IMPLEMENTATION_PLAN.md §3.2).
export interface DomainListDto {
    id?: number;
    name: string;
    description: string;
    wgRegionId: string;
    parentDomainId?: number;
    parentDomain?: ParentDomainDto;
    domainType: string;
}
