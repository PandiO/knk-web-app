You are GitHub Copilot working in the React + TypeScript frontend of the “Knights and Kings” project.

Goal
----
Implement full frontend support for the new backend entities:

- MinecraftBlockRef
- MinecraftMaterialRef

The backend DTOs are defined as follows (C#):

// --- MinecraftBlockRef DTOs ---
public class MinecraftBlockRefDto
{
    public int? Id { get; set; }
    public string NamespaceKey { get; set; } = null!;
    public string? BlockStateString { get; set; }
    public string? LogicalType { get; set; }
}

public class MinecraftBlockRefCreateDto
{
    public string NamespaceKey { get; set; } = null!;
    public string? BlockStateString { get; set; }
    public string? LogicalType { get; set; }
}

public class MinecraftBlockRefUpdateDto
{
    public string NamespaceKey { get; set; } = null!;
    public string? BlockStateString { get; set; }
    public string? LogicalType { get; set; }
}

public class MinecraftBlockRefListDto
{
    public int? Id { get; set; }
    public string NamespaceKey { get; set; } = null!;
    public string? LogicalType { get; set; }
}

// --- MinecraftMaterialRef DTOs ---
public class MinecraftMaterialRefDto
{
    public int? Id { get; set; }
    public string NamespaceKey { get; set; } = null!;
    public string? LegacyName { get; set; }
    public string Category { get; set; } = null!;
}

public class MinecraftMaterialRefCreateDto
{
    public string NamespaceKey { get; set; } = null!;
    public string? LegacyName { get; set; }
    public string Category { get; set; } = null!;
}

public class MinecraftMaterialRefUpdateDto
{
    public string NamespaceKey { get; set; } = null!;
    public string? LegacyName { get; set; }
    public string Category { get; set; } = null!;
}

public class MinecraftMaterialRefListDto
{
    public int? Id { get; set; }
    public string NamespaceKey { get; set; } = null!;
    public string Category { get; set; } = null!;
}

You must:
1. Create TypeScript DTO types for these backend DTOs.
2. Create API clients for both entities.
3. Extend the entity API mapping layer.
4. Add/update any necessary ObjectDashboard integration.

IMPORTANT:
- Follow the existing frontend architecture and patterns.
- Look at how Category (and other existing entities like Town, Street, District, Structure if present) are implemented:
  - DTO definitions in `src/utils/domain/dto`
  - API clients in `src/apiClients`
  - entity API mapping in `src/utils/entityApiMapping.ts`
  - any usage in `ObjectDashboard.tsx` (or similar dashboard/overview components)
- Re-use the same naming conventions, generics, utility functions, error handling and async patterns as those existing entities.
- Do NOT invent new patterns; copy the existing style.

1) DTO files in src/utils/domain/dto
------------------------------------

Create new TypeScript DTO definitions in the `src/utils/domain/dto` directory that correspond 1:1 to the backend DTOs.

Use the same naming conventions and folder structure as existing DTO files. For example, if there is a `CategoryDto.ts`, mirror that style.

Define at least the following TypeScript interfaces:

- `MinecraftBlockRefDto`
- `MinecraftBlockRefCreateDto`
- `MinecraftBlockRefUpdateDto`
- `MinecraftBlockRefListDto`

- `MinecraftMaterialRefDto`
- `MinecraftMaterialRefCreateDto`
- `MinecraftMaterialRefUpdateDto`
- `MinecraftMaterialRefListDto`

Property mapping should match the backend DTOs exactly (same property names and nullability):
- `id?: number | null`
- `namespaceKey: string`
- `blockStateString?: string | null`
- `logicalType?: string | null`
- `legacyName?: string | null`
- `category: string`

If there is a shared pattern (for example, a base DTO or a common `BaseListDto`), use it, just like for Category and other entities.

2) API clients in src/apiClients
--------------------------------

Create API client modules for both entities in `src/apiClients`, reusing the architecture and helper functions from the existing clients (for example the Category client).

Inspect the existing client(s), for example:

- `src/apiClients/categoryClient.ts` (or similarly named file)
- Any shared HTTP utility modules (e.g. Axios instance, fetch wrapper, generic CRUD helpers)

Create:

- `src/apiClients/minecraftBlockRefClient.ts`
- `src/apiClients/minecraftMaterialRefClient.ts`

Each client must:

- Use the same base HTTP client setup as the other clients.
- Use the same naming convention for exported functions, e.g.:

  For MinecraftMaterialRef:
  - `getMinecraftMaterialRefs` (list, possibly with filtering/paging if the pattern exists)
  - `getMinecraftMaterialRefById`
  - `createMinecraftMaterialRef`
  - `updateMinecraftMaterialRef`
  - `deleteMinecraftMaterialRef`

  For MinecraftBlockRef:
  - `getMinecraftBlockRefs`
  - `getMinecraftBlockRefById`
  - `createMinecraftBlockRef`
  - `updateMinecraftBlockRef`
  - `deleteMinecraftBlockRef`

- Use the TypeScript DTOs created in step 1 as types for request/response payloads.
- Use correct API routes based on the backend controllers (e.g. similar to `/api/Category`, use the same naming convention Copilot inferred when generating the backend controllers: likely `/api/MinecraftMaterialRef` / `/api/MinecraftBlockRef` or a kebab-case equivalent). Follow the same pattern used by the Category client: look at how the base path is defined there and apply the same logic.

3) Update src/utils/entityApiMapping.ts
---------------------------------------

Open `src/utils/entityApiMapping.ts`. This file contains an abstraction layer for per-entity API methods (create, update, fetch, etc).

You must:

- Add entries for `MinecraftMaterialRef` and `MinecraftBlockRef` that hook into the new API client functions.
- Follow the pattern used for existing entities (for example Category, Town, Street, District, Structure):
  - Use the same enum or key type for entity names.
  - Map those keys to objects that define the specific API functions for CRUD operations.
  - Ensure create/update/fetch/list/delete operations are wired to the correct functions from `minecraftMaterialRefClient` and `minecraftBlockRefClient`.

If the mapping uses generic types (e.g. `EntityApiDefinition<TListDto, TDetailDto, TCreateDto, TUpdateDto>`), provide the appropriate DTO types for both new entities.

Make sure TypeScript types compile correctly and that `entityApiMapping` exports remain consistent.

4) ObjectDashboard.tsx integration
----------------------------------

Locate `ObjectDashboard.tsx` (or similar dashboard component that lists and manages entities). Integrate the new Minecraft-related entities into this dashboard, **following the existing patterns used when other entities were added**.

Examples of what you may need to do, depending on the current implementation:

- If the dashboard uses an enum or configuration list of entity types, add entries for:
  - `MinecraftMaterialRef`
  - `MinecraftBlockRef`

- Ensure the dashboard can:
  - Display a list of MinecraftMaterialRef / MinecraftBlockRef records using the new list DTOs.
  - Use the new API mapping entries for fetching data.
  - Open the correct create/edit forms via the existing generic FormConfig / dynamic form system, if applicable.

- If the dashboard uses entity-specific metadata (labels, columns, icons, etc.), add minimal sensible defaults for the new entities consistent with existing ones:
  - e.g. display columns for `namespaceKey`, `category`, `logicalType`, etc.

Do NOT rewrite the dashboard; just extend it in the same way as it was extended for recently added entities like Town, Street, District and Structure.

5) General requirements
-----------------------

- Use the same coding style, imports, and alias conventions as the existing code.
- Ensure all new imports are correct and there are no circular dependencies.
- Make sure `npm run build` / `tsc` would compile without TypeScript errors after your changes.
- Prefer strongly typed APIs over `any`.
- Keep the code DRY by extracting shared logic if the pattern already exists in the project (for example, if there is a generic CRUD API helper, use it instead of custom ad-hoc fetch calls).

After you generate and modify the files, ensure that:
- All new DTO definitions live in `src/utils/domain/dto`.
- All new API client modules live in `src/apiClients`.
- `src/utils/entityApiMapping.ts` is updated to include both Minecraft-related entities.
- `ObjectDashboard.tsx` (or the relevant dashboard/overview component) knows how to display and manage these entities.

Do not remove or change existing behavior for other entities.
Only add the new MinecraftMaterialRef and MinecraftBlockRef support and the minimal glue needed so they fit seamlessly in the existing architecture.
