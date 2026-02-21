import React from 'react';
import { FormFieldDto } from '../../types/dtos/forms/FormModels';
import { FieldType } from '../../utils/enums';
import { Calendar, Plus, Minus, X, CheckCircle2, AlertTriangle, Loader2, Info, Pencil, Gamepad2, RefreshCw } from 'lucide-react';
import { PagedEntityTable, SelectionConfig } from '../PagedEntityTable/PagedEntityTable';
import { columnDefinitionsRegistry, defaultColumnDefinitions } from '../../config/objectConfigs';
import { HybridMaterialPicker } from '../minecraft/HybridMaterialPicker';
import { HybridEnchantmentPicker } from '../minecraft/HybridEnchantmentPicker';
import { ValidationResultDto } from '../../types/dtos/forms/FieldValidationRuleDtos';
import { interpolatePlaceholders } from '../../utils/placeholderInterpolation';

interface FieldRendererProps {
    field: FormFieldDto;
    value: any;
    onChange: (value: any) => void;
    error?: string;
    onBlur?: () => void;
    onCreateNew?: () => void;
    onEditInstance?: (instance: any, index?: number) => void;
    onWorldTaskAction?: () => void;
    worldTaskStatusVisible?: boolean;
    allStepsData?: { [stepIndex: number]: any }; // optional: for dependency evaluation
    currentStepIndex?: number; // optional: for context
    errors?: { [fieldName: string]: string }; // optional: error map
    validationResult?: ValidationResultDto;
    validationPending?: boolean;
    onRetryValidation?: () => void;
}

export const FieldRenderer: React.FC<FieldRendererProps> = ({
    field,
    value,
    onChange,
    error,
    onBlur,
    onCreateNew,
    onEditInstance,
    onWorldTaskAction,
    worldTaskStatusVisible,
    validationResult,
    validationPending,
    onRetryValidation
    // Note: allStepsData, currentStepIndex, errors are available in props but currently unused
}) => {
    const withFeedback = (content: React.ReactNode) => (
        <div className="space-y-1">
            {content}
            <ValidationFeedback
                validationResult={validationResult}
                pending={validationPending}
                onRetryValidation={onRetryValidation}
            />
        </div>
    );

    switch (field.fieldType) {
        case FieldType.String:
            return withFeedback(
                <StringField field={field} value={value} onChange={onChange} error={error} onBlur={onBlur} />
            );
        case FieldType.Integer:
            return withFeedback(
                <IntegerField field={field} value={value} onChange={onChange} error={error} onBlur={onBlur} />
            );
        case FieldType.Decimal:
            return withFeedback(
                <DecimalField field={field} value={value} onChange={onChange} error={error} onBlur={onBlur} />
            );
        case FieldType.Boolean:
            return withFeedback(<BooleanField field={field} value={value} onChange={onChange} error={error} />);
        case FieldType.DateTime:
            return withFeedback(
                <DateTimeField field={field} value={value} onChange={onChange} error={error} onBlur={onBlur} />
            );
        case FieldType.Enum:
            return withFeedback(
                <EnumField field={field} value={value} onChange={onChange} error={error} onBlur={onBlur} />
            );
        case FieldType.Object:
            return withFeedback(
                <ObjectField
                    field={field}
                    value={value}
                    onChange={onChange}
                    error={error}
                    onCreateNew={onCreateNew}
                    onEditInstance={onEditInstance}
                    onWorldTaskAction={onWorldTaskAction}
                    worldTaskStatusVisible={worldTaskStatusVisible}
                />
            );
        case FieldType.List:
            return withFeedback(
                <ListField
                    field={field}
                    value={value}
                    onChange={onChange}
                    error={error}
                    onEditInstance={onEditInstance}
                />
            );
        case FieldType.HybridMinecraftMaterialRefPicker: {
            const settings = parseHybridMaterialSettings(field.settingsJson);
            return withFeedback(
                <HybridMaterialPicker
                    label={field.label}
                    description={field.description}
                    value={value}
                    onChange={onChange}
                    required={field.isRequired}
                    error={error}
                    categoryFilter={settings.categoryFilter}
                    multiSelect={settings.multiSelect}
                />
            );
        }
        case FieldType.HybridMinecraftEnchantmentRefPicker: {
            const settings = parseHybridEnchantmentSettings(field.settingsJson);
            return withFeedback(
                <HybridEnchantmentPicker
                    label={field.label}
                    description={field.description}
                    value={value}
                    onChange={onChange}
                    required={field.isRequired}
                    error={error}
                    categoryFilter={settings.categoryFilter}
                    placeholder={field.placeholder}
                />
            );
        }
        default:
            return <div className="text-sm text-gray-500">Unsupported field type: {field.fieldType}</div>;
    }
};

const parseHybridMaterialSettings = (settingsJson?: string): { categoryFilter?: string; multiSelect: boolean } => {
    if (!settingsJson) return { multiSelect: false };
    try {
        const parsed = JSON.parse(settingsJson);
        return {
            categoryFilter: parsed.categoryFilter,
            multiSelect: !!parsed.multiSelect
        };
    } catch (err) {
        console.warn('Failed to parse hybrid material settingsJson', err);
        return { multiSelect: false };
    }
};

const parseHybridEnchantmentSettings = (settingsJson?: string): { categoryFilter?: string } => {
    if (!settingsJson) return {};
    try {
        const parsed = JSON.parse(settingsJson);
        return {
            categoryFilter: parsed.categoryFilter
        };
    } catch (err) {
        console.warn('Failed to parse hybrid enchantment settingsJson', err);
        return {};
    }
};

const ValidationFeedback: React.FC<{ validationResult?: ValidationResultDto; pending?: boolean; onRetryValidation?: () => void }> = ({ validationResult, pending, onRetryValidation }) => {
    const retryButton = onRetryValidation ? (
        <button
            type="button"
            onClick={onRetryValidation}
            disabled={!!pending}
            className="ml-2 text-xs px-2 py-1 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
            Re-run validation
        </button>
    ) : null;

    if (pending) {
        return (
            <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center">
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Validating…
                </div>
                {retryButton}
            </div>
        );
    }

    if (!validationResult) return null;

    const message = interpolatePlaceholders(validationResult.message, validationResult.placeholders);

    if (validationResult.isValid) {
        if (!message) return null;
        return (
            <div className="flex items-center justify-between text-xs text-green-700">
                <div className="flex items-center">
                    <CheckCircle2 className="h-4 w-4 mr-1" /> {message}
                </div>
                {retryButton}
            </div>
        );
    }

    const isBlocking = validationResult.isBlocking;
    const color = isBlocking ? 'text-red-700' : 'text-yellow-700';
    const Icon = isBlocking ? AlertTriangle : Info;

    return (
        <div className={`flex items-start justify-between text-xs ${color}`}>
            <div className="flex items-start">
                <Icon className="h-4 w-4 mr-1 mt-0.5" />
                <span>{message || 'Validation failed.'}</span>
            </div>
            {retryButton}
        </div>
    );
};

const StringField: React.FC<FieldRendererProps> = ({ field, value, onChange, error, onBlur }) => {
    const minecraftTextColorEnabled = parseMinecraftTextColorEnabled(field.settingsJson);
    const textValue = typeof value === 'string' ? value : '';

    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
                {field.label}
                {field.isRequired && <span className="text-red-500 ml-1">*</span>}
            </label>
            {field.description && (
                <p className="text-xs text-gray-500 mb-2">{field.description}</p>
            )}
            <textarea
                value={textValue}
                onChange={e => onChange(e.target.value)}
                onBlur={onBlur}
                placeholder={field.placeholder}
                disabled={field.isReadOnly}
                rows={3}
                className={`block w-full rounded-md shadow-sm sm:text-sm ${
                    error
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                        : 'border-gray-300 focus:border-primary focus:ring-primary'
                } ${field.isReadOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            />
            {minecraftTextColorEnabled && (
                <>
                    <p className="mt-1 text-xs text-blue-700">
                        Minecraft text coloring is enabled. Use &amp; followed by a code like 1-2-3-4-5-6-7-8-9-0-a-e-l.
                    </p>
                    <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-2">
                        <p className="text-xs text-gray-500 mb-1">Preview</p>
                        <MinecraftLegacyPreview text={textValue} />
                    </div>
                </>
            )}
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>
    );
};

type LegacyStyleState = {
    color?: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
    obfuscated?: boolean;
};

type LegacySegment = {
    text: string;
    style: LegacyStyleState;
};

const LEGACY_SECTION_CHAR = '§';
const LEGACY_ALT_CHAR = '&';
const LEGACY_TRANSLATABLE_CODES = '0123456789AaBbCcDdEeFfKkLlMmNnOoRrXx';

const LEGACY_COLOR_MAP: Record<string, string> = {
    '0': '#000000',
    '1': '#0000AA',
    '2': '#00AA00',
    '3': '#00AAAA',
    '4': '#AA0000',
    '5': '#AA00AA',
    '6': '#FFAA00',
    '7': '#AAAAAA',
    '8': '#555555',
    '9': '#5555FF',
    a: '#55FF55',
    b: '#55FFFF',
    c: '#FF5555',
    d: '#FF55FF',
    e: '#FFFF55',
    f: '#FFFFFF'
};

const translateAlternateColorCodes = (altColorChar: string, textToTranslate: string): string => {
    if (!textToTranslate) return '';
    const chars = textToTranslate.split('');
    for (let i = 0; i < chars.length - 1; i++) {
        if (chars[i] === altColorChar && LEGACY_TRANSLATABLE_CODES.indexOf(chars[i + 1]) > -1) {
            chars[i] = LEGACY_SECTION_CHAR;
            chars[i + 1] = chars[i + 1].toLowerCase();
        }
    }
    return chars.join('');
};

const tryReadBungeeHexColor = (input: string, sectionIndex: number): { hex: string; skipToIndex: number } | null => {
    if (input.charAt(sectionIndex + 1) !== 'x') return null;

    if (sectionIndex + 13 >= input.length) return null;

    let hex = '';
    let cursor = sectionIndex + 2;
    for (let part = 0; part < 6; part++) {
        if (input.charAt(cursor) !== LEGACY_SECTION_CHAR) return null;
        const digit = input.charAt(cursor + 1);
        if (!/[0-9a-f]/i.test(digit)) return null;
        hex += digit;
        cursor += 2;
    }

    return { hex: `#${hex.toLowerCase()}`, skipToIndex: cursor - 1 };
};

const toStyle = (state: LegacyStyleState): React.CSSProperties => ({
    color: state.color,
    fontWeight: state.bold ? 700 : undefined,
    fontStyle: state.italic ? 'italic' : undefined,
    textDecoration: [
        state.underline ? 'underline' : '',
        state.strikethrough ? 'line-through' : ''
    ]
        .filter(Boolean)
        .join(' ') || undefined,
    letterSpacing: state.obfuscated ? '0.08em' : undefined
});

const deserializeLegacyText = (input: string): LegacySegment[] => {
    if (!input) return [];

    const segments: LegacySegment[] = [];
    let state: LegacyStyleState = {};
    let currentText = '';

    const flush = () => {
        if (!currentText) return;
        segments.push({ text: currentText, style: { ...state } });
        currentText = '';
    };

    for (let i = 0; i < input.length; i++) {
        if (input.charAt(i) === LEGACY_SECTION_CHAR && i + 1 < input.length) {
            const hex = tryReadBungeeHexColor(input, i);
            if (hex) {
                flush();
                state = { color: hex.hex };
                i = hex.skipToIndex;
                continue;
            }

            const code = input.charAt(i + 1).toLowerCase();

            if (code in LEGACY_COLOR_MAP) {
                flush();
                state = { color: LEGACY_COLOR_MAP[code] };
                i++;
                continue;
            }

            if (code === 'k') {
                flush();
                state = { ...state, obfuscated: true };
                i++;
                continue;
            }
            if (code === 'l') {
                flush();
                state = { ...state, bold: true };
                i++;
                continue;
            }
            if (code === 'm') {
                flush();
                state = { ...state, strikethrough: true };
                i++;
                continue;
            }
            if (code === 'n') {
                flush();
                state = { ...state, underline: true };
                i++;
                continue;
            }
            if (code === 'o') {
                flush();
                state = { ...state, italic: true };
                i++;
                continue;
            }
            if (code === 'r') {
                flush();
                state = {};
                i++;
                continue;
            }
        }

        currentText += input.charAt(i);
    }

    flush();
    return segments;
};

const MinecraftLegacyPreview: React.FC<{ text: string }> = ({ text }) => {
    const translated = translateAlternateColorCodes(LEGACY_ALT_CHAR, text);
    const segments = deserializeLegacyText(translated);

    if (segments.length === 0) {
        return <p className="text-sm text-gray-700 whitespace-pre-wrap">{text || ' '}</p>;
    }

    return (
        <p className="text-sm whitespace-pre-wrap">
            {segments.map((segment, index) => (
                <span key={index} style={toStyle(segment.style)}>
                    {segment.text}
                </span>
            ))}
        </p>
    );
};

const parseMinecraftTextColorEnabled = (settingsJson?: string): boolean => {
    if (!settingsJson) return false;
    try {
        const parsed = JSON.parse(settingsJson);
        return !!parsed?.['minecraft-text-color']?.enabled;
    } catch (err) {
        console.warn('Failed to parse minecraft text color settingsJson', err);
        return false;
    }
};

const IntegerField: React.FC<FieldRendererProps> = ({ field, value, onChange, error, onBlur }) => {
    const increment = field.incrementValue || 1;
    const handleIncrement = () => onChange((Number(value) || 0) + increment);
    const handleDecrement = () => onChange((Number(value) || 0) - increment);

    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
                {field.label}
                {field.isRequired && <span className="text-red-500 ml-1">*</span>}
            </label>
            {field.description && <p className="text-xs text-gray-500 mb-2">{field.description}</p>}
            <div className="flex items-center space-x-2">
                <button
                    type="button"
                    onClick={handleDecrement}
                    disabled={field.isReadOnly}
                    className="p-2 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                >
                    <Minus className="h-4 w-4" />
                </button>
                <input
                    type="number"
                    value={value || ''}
                    onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
                    onBlur={onBlur}
                    placeholder={field.placeholder}
                    disabled={field.isReadOnly}
                    className={`block w-full rounded-md shadow-sm sm:text-sm text-center ${
                        error
                            ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                            : 'border-gray-300 focus:border-primary focus:ring-primary'
                    }`}
                />
                <button
                    type="button"
                    onClick={handleIncrement}
                    disabled={field.isReadOnly}
                    className="p-2 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                >
                    <Plus className="h-4 w-4" />
                </button>
            </div>
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>
    );
};

const DecimalField: React.FC<FieldRendererProps> = ({ field, value, onChange, error, onBlur }) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
            {field.label}
            {field.isRequired && <span className="text-red-500 ml-1">*</span>}
        </label>
        {field.description && <p className="text-xs text-gray-500 mb-2">{field.description}</p>}
        <input
            type="number"
            step="0.01"
            value={value || ''}
            onChange={e => onChange(e.target.value ? parseFloat(e.target.value) : null)}
            onBlur={onBlur}
            placeholder={field.placeholder}
            disabled={field.isReadOnly}
            className={`block w-full rounded-md shadow-sm sm:text-sm ${
                error
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:border-primary focus:ring-primary'
            }`}
        />
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
);

const BooleanField: React.FC<FieldRendererProps> = ({ field, value, onChange, error }) => (
    <div className="flex items-center">
        <input
            type="checkbox"
            id={field.fieldName}
            checked={!!value}
            onChange={e => onChange(e.target.checked)}
            disabled={field.isReadOnly}
            className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
        />
        <label htmlFor={field.fieldName} className="ml-2 block text-sm text-gray-900">
            {field.label}
            {field.isRequired && <span className="text-red-500 ml-1">*</span>}
        </label>
        {error && <p className="ml-2 text-sm text-red-600">{error}</p>}
    </div>
);

const DateTimeField: React.FC<FieldRendererProps> = ({ field, value, onChange, error, onBlur }) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
            {field.label}
            {field.isRequired && <span className="text-red-500 ml-1">*</span>}
        </label>
        {field.description && <p className="text-xs text-gray-500 mb-2">{field.description}</p>}
        <div className="relative">
            <input
                type="datetime-local"
                value={value || ''}
                onChange={e => onChange(e.target.value)}
                onBlur={onBlur}
                disabled={field.isReadOnly}
                className={`block w-full rounded-md shadow-sm sm:text-sm ${
                    error
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                        : 'border-gray-300 focus:border-primary focus:ring-primary'
                }`}
            />
            <Calendar className="absolute right-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
        </div>
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
);

const EnumField: React.FC<FieldRendererProps> = ({ field, value, onChange, error, onBlur }) => {
    // Parse enum values from defaultValue or placeholder
    const enumValues = (field.defaultValue || field.placeholder || '').split(',').map(v => v.trim()).filter(Boolean);

    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
                {field.label}
                {field.isRequired && <span className="text-red-500 ml-1">*</span>}
            </label>
            {field.description && <p className="text-xs text-gray-500 mb-2">{field.description}</p>}
            <select
                value={value || ''}
                onChange={e => onChange(e.target.value)}
                onBlur={onBlur}
                disabled={field.isReadOnly}
                className={`block w-full rounded-md shadow-sm sm:text-sm ${
                    error
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                        : 'border-gray-300 focus:border-primary focus:ring-primary'
                }`}
            >
                <option value="">Select {field.label}</option>
                {enumValues.map(val => (
                    <option key={val} value={val}>{val}</option>
                ))}
            </select>
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>
    );
};

const ObjectField: React.FC<FieldRendererProps> = ({
    field,
    value,
    onChange,
    error,
    onCreateNew,
    onEditInstance,
    onWorldTaskAction,
    worldTaskStatusVisible
}) => {
    const canCreate = field.canCreate !== false; // default true if not specified
    const [showReplaceTable, setShowReplaceTable] = React.useState(false);

    React.useEffect(() => {
        if (value) {
            setShowReplaceTable(false);
        }
    }, [value]);

    const selectionConfig: SelectionConfig = {
        mode: 'single'
    };

    const handleSelectionChange = (selected: any[]) => {
        onChange(selected[0] || null);
    };

    // changed: handler to remove selected item
    const handleRemoveSelection = () => {
        onChange(null);
    };

    const showHorizontalActions = !worldTaskStatusVisible;
    const actions: Array<{ key: string; label: string; onClick: () => void; icon?: React.ReactNode }> = [];

    if (onCreateNew && canCreate) {
        actions.push({
            key: 'create',
            label: 'Create New',
            onClick: onCreateNew,
            icon: <Plus className="h-4 w-4" />
        });
    }

    if (value && onEditInstance) {
        actions.push({
            key: 'edit',
            label: 'Edit instance',
            onClick: () => onEditInstance(value),
            icon: <Pencil className="h-4 w-4" />
        });
    }

    if (onWorldTaskAction) {
        actions.push({
            key: 'worldtask',
            label: value ? 'Replace via Minecraft' : 'Send to Minecraft',
            onClick: onWorldTaskAction,
            icon: <Gamepad2 className="h-4 w-4" />
        });
    }

    actions.push({
        key: 'replace',
        label: 'Replace instance',
        onClick: () => setShowReplaceTable(prev => !prev),
        icon: <RefreshCw className="h-4 w-4" />
    });

    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
                {field.label}
                {field.isRequired && <span className="text-red-500 ml-1">*</span>}
            </label>
            {field.description && <p className="text-xs text-gray-500 mb-2">{field.description}</p>}
            
            {/* changed: moved selected item display above the table */}
            {value && (
                <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-md flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                            <span className="text-green-600 font-medium text-sm">
                                {(value.name || value.Name || '?').charAt(0).toUpperCase()}
                            </span>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-green-900">
                                {value.name || value.Name || 'Selected Item'}
                            </p>
                            <p className="text-xs text-green-600">ID: {value.id}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleRemoveSelection}
                        className="text-red-600 hover:text-red-800 hover:bg-red-100 rounded-full p-1"
                        title="Remove selection"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            <div className="space-y-2">
                <div className="self-start">
                    <details className="relative sm:hidden">
                        <summary className="btn-secondary whitespace-nowrap cursor-pointer list-none">
                            Actions
                        </summary>
                        <div className="absolute right-0 z-20 mt-2 min-w-[220px] rounded-md border border-gray-200 bg-white p-2 shadow-lg">
                            {actions.map(action => (
                                <button
                                    key={action.key}
                                    type="button"
                                    onClick={action.onClick}
                                    className="w-full px-3 py-2 text-sm rounded hover:bg-gray-50 inline-flex items-center gap-2"
                                >
                                    {action.icon}
                                    {action.label}
                                </button>
                            ))}
                        </div>
                    </details>

                    <div className={`hidden sm:flex items-start ${showHorizontalActions ? 'flex-row flex-wrap gap-2' : 'flex-col gap-2'}`}>
                        {onCreateNew && canCreate && (
                            <button
                                type="button"
                                onClick={onCreateNew}
                                className="btn-secondary whitespace-nowrap inline-flex items-center gap-1"
                            >
                                <Plus className="h-4 w-4" />
                                Create New
                            </button>
                        )}
                        {value && onEditInstance && (
                            <button
                                type="button"
                                onClick={() => onEditInstance(value)}
                                className="btn-secondary whitespace-nowrap inline-flex items-center gap-1"
                            >
                                <Pencil className="h-4 w-4" />
                                Edit instance
                            </button>
                        )}
                        {onWorldTaskAction && (
                            <button
                                type="button"
                                onClick={onWorldTaskAction}
                                className="btn-secondary whitespace-nowrap inline-flex items-center gap-1"
                            >
                                <Gamepad2 className="h-4 w-4" />
                                {value ? 'Replace via Minecraft' : 'Send to Minecraft'}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setShowReplaceTable(prev => !prev)}
                            className="btn-secondary whitespace-nowrap inline-flex items-center gap-1"
                        >
                            <RefreshCw className="h-4 w-4" />
                            Replace instance
                        </button>
                    </div>
                </div>

                {showReplaceTable && (
                    <div className="relative">
                        <PagedEntityTable
                            entityTypeName={field.objectType!}
                            columns={columnDefinitionsRegistry[field.objectType!]?.default || defaultColumnDefinitions.default}
                            initialQuery={{ page: 1, pageSize: 10}}
                            selectionConfig={selectionConfig}
                            selectedItems={value ? [value] : []}
                            onSelectionChange={handleSelectionChange}
                            showSelectionBanner={false}
                        />
                    </div>
                )}
            </div>
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>
    );
};

const ListField: React.FC<FieldRendererProps> = ({ field, value, onChange, error, onEditInstance }) => {
    console.log('Rendering ListField with value:', value);
    const items = Array.isArray(value) ? value : [];
    
    const listElementType = field.elementType || FieldType.String;
    const isObjectList = field.objectType != null;

    const selectionConfig: SelectionConfig = {
        mode: 'multiple',
        min: field.minSelection,
        max: field.maxSelection
    };

    const handleSelectionChange = (selected: any[]) => {
        onChange(selected);
    };

    const handleRemoveItem = (itemId: string) => {
        onChange(items.filter(item => item.id !== itemId));
    };

    if (!isObjectList) {
        const addItem = () => onChange([...items, '']);
        const removeItem = (index: number) => onChange(items.filter((_, i) => i !== index));
        const updateItem = (index: number, newValue: any) => {
            const updated = [...items];
            updated[index] = newValue;
            onChange(updated);
        };

        return (
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field.label}
                    {field.isRequired && <span className="text-red-500 ml-1">*</span>}
                </label>
                {field.description && <p className="text-xs text-gray-500 mb-2">{field.description}</p>}
                <div className="space-y-2">
                    {items.map((item, index) => (
                        <div key={index} className="flex items-center space-x-2">
                            {listElementType === FieldType.String && (
                                <input
                                    type="text"
                                    value={item ?? ''}
                                    onChange={e => updateItem(index, e.target.value)}
                                    className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                />
                            )}
                            {listElementType === FieldType.Integer && (
                                <input
                                    type="number"
                                    value={item ?? 0}
                                    onChange={e => updateItem(index, parseInt(e.target.value) || 0)}
                                    className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                />
                            )}
                            {listElementType === FieldType.Decimal && (
                                <input
                                    type="number"
                                    step="0.01"
                                    value={item ?? 0}
                                    onChange={e => updateItem(index, parseFloat(e.target.value) || 0)}
                                    className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                />
                            )}
                            <button
                                type="button"
                                onClick={() => removeItem(index)}
                                className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md"
                            >
                                <Minus className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={addItem}
                        className="btn-secondary w-full"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Item
                    </button>
                </div>
                {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
            </div>
        );
    }

    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
                {field.label}
                {field.isRequired && <span className="text-red-500 ml-1">*</span>}
            </label>
            {field.description && <p className="text-xs text-gray-500 mb-2">{field.description}</p>}
            
            {!field.objectType ? (
                <div className="text-sm text-red-600">
                    Object type is required for Object lists. Please configure this field.
                </div>
            ) : (
                <>
                    {/* changed: moved selected items display above the table */}
                    {items.length > 0 && (
                        <div className="mb-3 space-y-2">
                            <p className="text-xs font-medium text-gray-700">
                                Selected ({items.length}):
                            </p>
                            <div className="max-h-32 overflow-y-auto space-y-2">
                                {items.map((item) => (
                                    <div
                                        key={item.id}
                                        className="p-2 bg-green-50 border border-green-200 rounded-md flex items-center justify-between"
                                    >
                                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                                            <div className="flex-shrink-0 h-6 w-6 rounded-full bg-green-100 flex items-center justify-center">
                                                <span className="text-green-600 font-medium text-xs">
                                                    {(item.name || item.Name || '?').charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-green-900 truncate">
                                                    {item.name || item.Name || 'Item'}
                                                </p>
                                                <p className="text-xs text-green-600">ID: {item.id}</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveItem(item.id)}
                                            className="text-green-600 hover:text-green-800 hover:bg-green-100 rounded-full p-1 flex-shrink-0"
                                            title="Remove from selection"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                        {onEditInstance && (
                                            <button
                                                type="button"
                                                onClick={() => onEditInstance(item, items.findIndex(current => current.id === item.id))}
                                                className="btn-secondary whitespace-nowrap ml-2"
                                            >
                                                Edit instance
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="border border-gray-200 rounded-md p-4">
                        <PagedEntityTable
                            entityTypeName={field.objectType}
                            columns={columnDefinitionsRegistry[field.objectType]?.default || defaultColumnDefinitions.default}
                            initialQuery={{ page: 1, pageSize: 5 }}
                            selectionConfig={selectionConfig}
                            selectedItems={items}
                            onSelectionChange={handleSelectionChange}
                            showSearchBar={true}
                            showSelectionBanner={false}
                        />
                    </div>
                </>
            )}
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>
    );
};

