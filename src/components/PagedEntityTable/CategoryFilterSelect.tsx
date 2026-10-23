import React, { useEffect, useMemo, useState } from 'react';
import { CategoryClient } from '../../apiClients/categoryClient';
import { CategoryDto } from '../../types/dtos/category/CategoryDtos';
import { categoryOptions, categoryWithDescendants } from '../../utils/categoryTree';

interface CategoryFilterSelectProps {
    /** The selected category id, or undefined for all categories. */
    value?: string;
    /** The chosen category and the ids it covers (itself and every child), or undefined for all. */
    onChange: (categoryId: string | undefined, covered: ReadonlySet<string> | undefined) => void;
    /** Overrides loading the categories from the API (tests). */
    loadCategories?: () => Promise<CategoryDto[]>;
}

/**
 * KNG-263: "Category" filter for item blueprint tables. The list is the category tree (children
 * indented under their parent); choosing a category also covers its children - the API's search
 * expands `CategoryId` the same way.
 */
export const CategoryFilterSelect: React.FC<CategoryFilterSelectProps> = ({ value, onChange, loadCategories }) => {
    const [categories, setCategories] = useState<CategoryDto[]>([]);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let active = true;
        (loadCategories ?? (() => CategoryClient.getInstance().getAll()))()
            .then(result => { if (active) setCategories(result ?? []); })
            .catch(() => { if (active) setFailed(true); });
        return () => { active = false; };
    }, [loadCategories]);

    const options = useMemo(() => categoryOptions(categories), [categories]);

    const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const id = event.target.value || undefined;
        onChange(id, id ? categoryWithDescendants(categories, id) : undefined);
    };

    return (
        <select
            aria-label="Category filter"
            value={value ?? ''}
            onChange={handleChange}
            disabled={failed}
            title={failed ? "Categories couldn't be loaded" : 'Shows the chosen category and every category below it'}
            className="block rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
        >
            <option value="">{failed ? 'Categories unavailable' : 'All categories'}</option>
            {options.map(option => (
                <option key={option.id} value={option.id}>
                    {`${'  '.repeat(option.depth)}${option.depth > 0 ? '└ ' : ''}${option.name}`}
                </option>
            ))}
        </select>
    );
};
