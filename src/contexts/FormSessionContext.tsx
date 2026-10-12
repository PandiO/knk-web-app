import React, { createContext, useCallback, useContext, useMemo, useRef, useState, ReactNode } from 'react';

/**
 * KNG-136: the form session registry (knk-workspace
 * docs/specs/form-configurations/FORM_WIZARD_SESSION_CONCEPTS.md §3.2).
 *
 * A root wizard (the first FormWizard with no session above it) owns one registry for its lifetime;
 * every nested wizard (ChildFormModal, JoinEntityFormModal) joins it through FormSessionScope, so a
 * District saved two forms deep (GateStructure -> Street -> District) is known to the
 * GateStructure's own District picker. Pickers pin the entities created here (useSessionPinnedRows).
 *
 * KNG-162 reads "what this root form created" from createdEntities() (entity type, id, origin,
 * order), keeps it in the root draft (createdEntitiesJson, decision D3) and seeds it back with seed()
 * when the draft is resumed, so pickers pin those entities again.
 */

export type SessionEntityStatus = 'created' | 'updated';

export interface SessionEntityOrigin {
    /** The forms from the root to the one whose field opened the child, e.g. ["GateStructure", "Street"]. */
    formPath: string[];
    /** The field of the last form in formPath, e.g. "Districts". */
    fieldName: string;
}

export interface SessionEntity {
    /** `${entityTypeName}:${id}` (type lower-cased), or `concept:<n>` for an embedded value without an id. */
    key: string;
    entityTypeName: string;
    id?: number | string;
    /** The DTO / form values the child form returned; used for labels and columns. */
    display: Record<string, unknown>;
    origin: SessionEntityOrigin;
    /** 'created' if this session made the entity; an entity created and then edited here stays 'created'. */
    status: SessionEntityStatus;
    /** Embedded value objects (a single Object Location) are saved with their parent, not on their own. */
    embedded: boolean;
    /** Registration order (1, 2, ...): later entries were created after, and usually deeper than, earlier ones. */
    sequence: number;
    /** Bumped on every re-registration, so pickers refetch after an edit too. */
    revision: number;
}

export interface SessionEntityInput {
    entityTypeName: string;
    entity: Record<string, unknown>;
    fieldName: string;
    status: SessionEntityStatus;
    embedded?: boolean;
}

export interface FormSessionValue {
    /** This form's place in the session, root first. */
    formPath: string[];
    entities: SessionEntity[];
    /** Adds or refreshes an entry; origin.formPath is this scope's formPath. Returns the entry, or null if it can't be keyed. */
    register: (input: SessionEntityInput) => SessionEntity | null;
    /** Entries for one entity type (case-insensitive). */
    entitiesOfType: (entityTypeName: string) => SessionEntity[];
    /** What this root form's child forms saved on their own (status 'created', not embedded), oldest first. */
    createdEntities: () => SessionEntity[];
    /** KNG-162: adds entities a resumed draft recorded (as created, before anything registered since). */
    seed: (entries: SessionSeedEntry[]) => void;
}

/** An entity recorded in a draft (utils/forms/createdEntities.ts CreatedEntityRecord has this shape). */
export interface SessionSeedEntry {
    entityTypeName: string;
    id: number | string;
    display: Record<string, unknown>;
    origin: SessionEntityOrigin;
    sequence: number;
}

interface RegistryStore {
    entities: SessionEntity[];
    register: (input: SessionEntityInput, formPath: string[]) => SessionEntity | null;
    seed: (entries: SessionSeedEntry[]) => void;
}

// The registry is shared by the root wizard and every wizard nested under it; the form path is per wizard.
const RegistryContext = createContext<RegistryStore | null>(null);
const FormPathContext = createContext<string[]>([]);

const hasId = (id: unknown): id is number | string =>
    id !== undefined && id !== null && id !== '';

const readId = (entity: Record<string, unknown>): number | string | undefined => {
    const id = entity.id ?? entity.Id;
    return hasId(id) && (typeof id === 'number' || typeof id === 'string') ? id : undefined;
};

export const sessionEntityKey = (entityTypeName: string, id: number | string): string =>
    `${entityTypeName.toLowerCase()}:${String(id)}`;

/**
 * Pure registry update: adds the entry or refreshes the one with the same key. Exported for tests.
 * `nextSequence` numbers a new entry; `conceptKey` keys an embedded value without an id.
 */
export function upsertSessionEntity(
    entities: SessionEntity[],
    input: SessionEntityInput,
    formPath: string[],
    nextSequence: number,
    conceptKey: () => string
): { entities: SessionEntity[]; entry: SessionEntity | null } {
    const entityTypeName = (input.entityTypeName || '').trim();
    if (!entityTypeName || !input.entity || typeof input.entity !== 'object') {
        return { entities, entry: null };
    }
    const embedded = input.embedded === true;
    const id = readId(input.entity);
    if (!hasId(id) && !embedded) {
        // A saved child always has an id; without one there is nothing a picker could select.
        return { entities, entry: null };
    }
    const key = hasId(id) ? sessionEntityKey(entityTypeName, id) : conceptKey();

    const existingIndex = entities.findIndex(entry => entry.key === key);
    if (existingIndex >= 0) {
        const existing = entities[existingIndex];
        const updated: SessionEntity = {
            ...existing,
            display: { ...existing.display, ...input.entity },
            status: existing.status === 'created' ? 'created' : input.status,
            revision: existing.revision + 1
        };
        const next = [...entities];
        next[existingIndex] = updated;
        return { entities: next, entry: updated };
    }

    const entry: SessionEntity = {
        key,
        entityTypeName,
        id,
        display: { ...input.entity },
        origin: { formPath: [...formPath], fieldName: input.fieldName },
        status: input.status,
        embedded,
        sequence: nextSequence,
        revision: 1
    };
    return { entities: [...entities, entry], entry };
}

/**
 * Pure seeding (KNG-162): recorded entities not in the registry yet are added as created, in their
 * recorded order, numbered from `firstSequence`. Entries already present (same key) are left as they
 * are. Exported for tests.
 */
export function seedSessionEntities(
    entities: SessionEntity[],
    entries: SessionSeedEntry[],
    firstSequence: number
): { entities: SessionEntity[]; lastSequence: number } {
    let sequence = firstSequence - 1;
    const next = [...entities];
    const keys = new Set(entities.map(entry => entry.key));
    [...entries]
        .sort((a, b) => a.sequence - b.sequence)
        .forEach(entry => {
            const entityTypeName = (entry.entityTypeName || '').trim();
            if (!entityTypeName || !hasId(entry.id)) return;
            const key = sessionEntityKey(entityTypeName, entry.id);
            if (keys.has(key)) return;
            keys.add(key);
            sequence += 1;
            next.push({
                key,
                entityTypeName,
                id: entry.id,
                display: { ...entry.display, id: entry.id },
                origin: { formPath: [...(entry.origin?.formPath ?? [])], fieldName: entry.origin?.fieldName ?? '' },
                status: 'created',
                embedded: false,
                sequence,
                revision: 1
            });
        });
    return { entities: next, lastSequence: sequence };
}

const RootRegistry: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [entities, setEntities] = useState<SessionEntity[]>([]);
    // Mirrors `entities` synchronously, so two registrations in one event both land.
    const entitiesRef = useRef<SessionEntity[]>([]);
    const counters = useRef({ sequence: 0, concept: 0 });

    const register = useCallback((input: SessionEntityInput, formPath: string[]) => {
        const { entities: next, entry } = upsertSessionEntity(
            entitiesRef.current,
            input,
            formPath,
            counters.current.sequence + 1,
            () => {
                counters.current.concept += 1;
                return `concept:${counters.current.concept}`;
            }
        );
        if (!entry) return null;
        if (entry.revision === 1) counters.current.sequence = entry.sequence;
        entitiesRef.current = next;
        setEntities(next);
        return entry;
    }, []);

    const seed = useCallback((entries: SessionSeedEntry[]) => {
        const { entities: next, lastSequence } = seedSessionEntities(
            entitiesRef.current,
            entries,
            counters.current.sequence + 1
        );
        if (next.length === entitiesRef.current.length) return;
        counters.current.sequence = lastSequence;
        entitiesRef.current = next;
        setEntities(next);
    }, []);

    const store = useMemo<RegistryStore>(() => ({ entities, register, seed }), [entities, register, seed]);
    return <RegistryContext.Provider value={store}>{children}</RegistryContext.Provider>;
};

/**
 * KNG-162: starts a session above the root wizard without adding a form to the path, so a page can
 * read the registry next to the wizard (FormWizardPage's Cancel). The wizard's own FormSessionScope
 * joins it. Key it per opened form so each form starts with an empty registry.
 */
export const FormSessionRoot: React.FC<{ children: ReactNode }> = ({ children }) => {
    const registry = useContext(RegistryContext);
    return registry ? <>{children}</> : <RootRegistry>{children}</RootRegistry>;
};

/**
 * Wraps one wizard. With no session above it, it starts one (the root form); otherwise it joins the
 * session above. Either way formName is appended to the form path.
 */
export const FormSessionScope: React.FC<{ formName: string; children: ReactNode }> = ({ formName, children }) => {
    const registry = useContext(RegistryContext);
    const parentPath = useContext(FormPathContext);
    const formPath = useMemo(() => [...parentPath, formName], [parentPath, formName]);
    const scoped = <FormPathContext.Provider value={formPath}>{children}</FormPathContext.Provider>;
    return registry ? scoped : <RootRegistry>{scoped}</RootRegistry>;
};

/** The current form session, or null outside a wizard (e.g. a FieldRenderer on its own). */
export const useFormSession = (): FormSessionValue | null => {
    const registry = useContext(RegistryContext);
    const formPath = useContext(FormPathContext);
    return useMemo(() => {
        if (!registry) return null;
        const { entities, register, seed } = registry;
        return {
            formPath,
            entities,
            register: input => register(input, formPath),
            entitiesOfType: entityTypeName => {
                const wanted = entityTypeName.toLowerCase();
                return entities.filter(entry => entry.entityTypeName.toLowerCase() === wanted);
            },
            createdEntities: () => entities
                .filter(entry => entry.status === 'created' && !entry.embedded)
                .sort((a, b) => a.sequence - b.sequence),
            seed
        };
    }, [registry, formPath]);
};
