/** Read-only row returned for the abstract User-or-PermissionGroup relationship picker. */
export interface PermissionHolderListDto {
  id: number;
  name: string;
  holderType: 'User' | 'PermissionGroup';
}
