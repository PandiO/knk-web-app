import { ColumnDefinition } from '../../types/common';

const normalize = (text: string) => text.toLowerCase().replace(/[\s_-]/g, '');

/**
 * The built-in column a saved table column (EntityTypeConfiguration.DefaultTableColumns) stands for.
 * Saved keys are metadata field names, so a related entity is saved as its navigation ("Town",
 * "District", "Street") while the built-in picker columns read the list DTO's flat field
 * (townName, districtName, streetName) and render it. Without this match the saved "Town" column
 * read row.Town, which no list DTO has, and showed "-" on every row.
 *
 * Tried in order: the same key, the key + "Name", then a column whose label is the key.
 */
export const matchBuiltInColumn = <T,>(
    savedKey: string,
    builtIn: ColumnDefinition<T>[]
): ColumnDefinition<T> | undefined => {
    const key = normalize(savedKey);
    return builtIn.find(column => normalize(column.key) === key)
        ?? builtIn.find(column => normalize(column.key) === `${key}name`)
        ?? builtIn.find(column => normalize(column.label) === key);
};
