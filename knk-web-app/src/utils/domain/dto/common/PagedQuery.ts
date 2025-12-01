export interface PagedQueryDto {
    page: number;
    pageSize: number;
    searchTerm?: string;
    sortBy?: string;
    sortDescending?: boolean;
    filters?: Record<string, any>;
}

export interface PagedResultDto<T> {
    items: T[];
    totalCount: number;
    page: number;
    pageSize: number;
    totalPages: number;
}
