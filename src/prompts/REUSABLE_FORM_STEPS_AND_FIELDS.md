You are working in the Knights & Kings React + Vite + TypeScript frontend for the dynamic FormBuilder / FormWizard system.

We’ve just implemented backend support for reusable FormStep and FormField templates in the Web API (knkwebapi_v2). Your job is to implement the corresponding frontend logic and UI, reusing the existing architecture and patterns.

## High-level goal

Implement full frontend support for:

1. Marking FormSteps and FormFields as reusable “templates”.
2. Browsing and selecting reusable FormSteps / FormFields from a template library when building a FormConfiguration.
3. Adding a reusable step or field to a configuration/step in either **Copy** or **Link** mode.
4. Handling backend validation / errors cleanly, including the case where the backend rejects saving a configuration due to template incompatibilities.
5. Surfacing compatibility issues visually per step/field when the DTOs indicate them (hasCompatibilityIssues + compatibilityIssues/stepLevelIssues), so the UI is ready for the more detailed validation feature.

Use the existing code style, structure and reusable utilities. Do NOT break other entities or FormBuilder flows.

---

## Backend contract (treat this as the source of truth)

The backend exposes these endpoints on `FormConfigurationsController`:

- `GET /api/form-configurations/reusable-steps`
  - Returns a list of **FormStepDto** objects that are marked as reusable templates.

- `GET /api/form-configurations/reusable-fields`
  - Returns a list of **FormFieldDto** objects that are marked as reusable templates.

- `POST /api/form-configurations/{configId}/steps/add-from-template`
  - Request body: **AddReusableStepRequest**
    - `sourceStepId: number`
    - `linkMode: string` // "Copy" or "Link" (case-insensitive on the backend)
  - On success: returns the newly added **FormStepDto** representing the step added to the configuration (either copied or linked).
  - On error:
    - `404` if the source step or configuration does not exist.
    - `400` with an error message if the step is not reusable or validation fails (e.g. incompatible fields for the target entity).

- `POST /api/form-configurations/steps/{stepId}/fields/add-from-template`
  - Request body: **AddReusableFieldRequest**
    - `sourceFieldId: number`
    - `linkMode: string` // "Copy" or "Link"
  - On success: returns the newly added **FormFieldDto** representing the field added to the step.
  - On error:
    - `404` if the source field or step does not exist.
    - `400` if the field is not reusable or validation fails.

DTOs (from the backend Dtos):

- **FormFieldDto** (JSON property names):
  - `id: string | null`
  - `formStepId: string | null`
  - `fieldName: string`
  - `label: string`
  - `placeholder?: string | null`
  - `description?: string | null`
  - `fieldType: FieldType`
  - `elementType?: FieldType | null`
  - `defaultValue?: string | null`
  - `isRequired: boolean`
  - `isReadOnly: boolean`
  - `order: number`
  - `dependencyConditionJson?: string | null`
  - `objectType?: string | null`
  - `subConfigurationId?: string | null`
  - `incrementValue?: number | null`
  - **New / important for this feature:**
    - `isReusable: boolean`
    - `sourceFieldId?: string | null`
    - `isLinkedToSource: boolean`
    - `hasCompatibilityIssues: boolean`
    - `compatibilityIssues?: string[] | null`
  - `validations: FieldValidationDto[]`

- **FormStepDto**:
  - `id: string | null`
  - `formConfigurationId: string | null`
  - `stepName: string`
  - `title: string`
  - `description?: string | null`
  - `order: number`
  - `fieldOrderJson?: string | null`
  - **New / important:**
    - `isReusable: boolean`
    - `sourceStepId?: string | null`
    - `isLinkedToSource: boolean`
    - `hasCompatibilityIssues: boolean`
    - `stepLevelIssues?: string[] | null`
  - `fields: FormFieldDto[]`
  - `conditions: StepConditionDto[]`

Also note `ReuseLinkMode` on the backend has two values: `Copy` and `Link`. The API is case-insensitive, so sending `"copy"` / `"link"` from the frontend is acceptable.

The backend runs a metadata-based validation (via `FormTemplateValidationService` and `IMetadataService`) whenever a FormConfiguration is created or updated. If the configuration is invalid (e.g., incompatible fields), it throws an `InvalidOperationException` and the controller returns `400 BadRequest` with a summary message. The frontend must show this summary clearly when saving a configuration fails.

---

## Frontend architecture assumptions

The frontend is a React + TS app with:

- API clients in `src/apiClients/` (e.g. `formConfigurationClient`, `formFieldClient`, etc.)
- DTOs in `src/utils/domain/dto/` (including FormConfigurationDto / FormStepDto / FormFieldDto)
- Central mapping utilities in `src/utils/entityApiMapping.ts`
- A FormConfigBuilder UI (components like `FormConfigurationBuilder`, `FormStepEditor`, `FormFieldEditor`, etc.), which already has **“Add step from template”** and **“Add field from template”** buttons but currently no real business logic behind them.
- The FormBuilder already uses entity metadata (EntityMetadataDto) to dynamically render fields.

Use that existing structure and naming; don’t invent a completely new architecture.

---

## Tasks

### 1. Define/update frontend DTO types for reuse & validation

1. Locate the existing TS interfaces for the form DTOs (e.g. in `src/utils/domain/dto/forms.ts` or similar):
   - `FormConfigurationDto`
   - `FormStepDto`
   - `FormFieldDto`
   - `FieldValidationDto`
   - `StepConditionDto`

2. Update `FormStepDto` and `FormFieldDto` so their properties match the backend JSON contract above, including:
   - `isReusable`, `sourceStepId`, `isLinkedToSource`, `hasCompatibilityIssues`, `stepLevelIssues?` on steps.
   - `isReusable`, `sourceFieldId`, `isLinkedToSource`, `hasCompatibilityIssues`, `compatibilityIssues?` on fields.

3. Add a small TS type / enum for link mode, e.g. in a shared DTO or types file:

   ```ts
   export type ReuseLinkMode = 'copy' | 'link';
(Optional but recommended) Add TS interfaces mirroring the backend template validation DTOs, so we can easily consume them later if extra validation endpoints are added:

ts
Code kopiëren
export interface TemplateFieldValidationResultDto {
  formFieldId: number;
  fieldName: string;
  isCompatible: boolean;
  issues: string[];
}

export interface TemplateStepValidationResultDto {
  formStepId: number;
  stepName: string;
  isCompatible: boolean;
  fieldResults: TemplateFieldValidationResultDto[];
}

export interface FormConfigurationValidationResultDto {
  formConfigurationId: number;
  entityTypeName: string;
  isValid: boolean;
  summary?: string | null;
  stepResults: TemplateStepValidationResultDto[];
}

export interface AddReusableStepRequestDto {
  sourceStepId: number;
  linkMode: ReuseLinkMode;
}

export interface AddReusableFieldRequestDto {
  sourceFieldId: number;
  linkMode: ReuseLinkMode;
}
Keep all naming conventions consistent with the rest of the DTO folder (camelCase for JSON properties, etc.).

2. Extend the FormConfiguration API client
Create or update an API client in src/apiClients/formConfigurationClient.ts (or whichever file currently handles FormConfiguration endpoints).

Add functions:

ts
Code kopiëren
import {
  FormConfigurationDto,
  FormStepDto,
  FormFieldDto,
  AddReusableStepRequestDto,
  AddReusableFieldRequestDto,
} from '@/utils/domain/dto/...';
import { ReuseLinkMode } from '@/utils/domain/dto/...';

export async function getReusableSteps(): Promise<FormStepDto[]> { ... }

export async function getReusableFields(): Promise<FormFieldDto[]> { ... }

export async function addReusableStepToConfiguration(
  configId: number,
  payload: AddReusableStepRequestDto
): Promise<FormStepDto> { ... }

export async function addReusableFieldToStep(
  stepId: number,
  payload: AddReusableFieldRequestDto
): Promise<FormFieldDto> { ... }
Implementation details:

Use the same HTTP helper / axios wrapper and error handling patterns as other API clients in src/apiClients/.

Endpoints:

GET /api/form-configurations/reusable-steps

GET /api/form-configurations/reusable-fields

POST /api/form-configurations/${configId}/steps/add-from-template

POST /api/form-configurations/steps/${stepId}/fields/add-from-template

Default linkMode to "copy" unless explicitly overridden by the user.

3. Wire up “Add from template” buttons in the FormBuilder UI
Find the FormBuilder / FormConfigurationBuilder components that currently expose:

“Add step from template” button for a configuration.

“Add field from template” button for a step.

Implement the full flow:

3.1. Template selection UI for steps
When the user clicks “Add step from template”:

Open a modal / drawer listing all reusable step templates, retrieved via getReusableSteps().

Show at least:

Step name / title

Source entity type / configuration info if available (if not easily accessible, just show the name and description).

Allow filtering by:

Current entity type name (if possible, to only show templates that likely make sense).

Text search on step name / description.

When the user selects a template and confirms:

Ask the user whether they want Copy or Link mode.

A simple toggle, radio buttons, or dropdown is enough.

Default to "copy" for safety.

Call:

ts
Code kopiëren
await addReusableStepToConfiguration(configId, {
  sourceStepId: selectedStepId,
  linkMode,
});
On success:

Merge the returned FormStepDto into the current FormConfiguration state.

Ensure that order and fieldOrderJson remain consistent in the local state (respect the backend’s fieldOrderJson/stepOrderJson semantics).

On error:

Show a user-friendly error (toast/banner) using the message from the backend response if available (e.g. “Step is not reusable”, or the validation summary).

3.2. Template selection UI for fields
When the user clicks “Add field from template” for a given step:

Open a modal listing all reusable field templates, from getReusableFields().

Allow filtering by:

Field name / label.

(Optionally) compatible fieldType or objectType relative to the current entity metadata.

After selection:

Prompt the user for Copy vs Link mode (same UX pattern as for steps).

Call:

ts
Code kopiëren
await addReusableFieldToStep(stepId, {
  sourceFieldId: selectedFieldId,
  linkMode,
});
On success:

Merge the returned FormFieldDto into the step’s fields array, adjusting order and local ordering if needed.

On error:

Show the backend message, and keep the UI state unchanged.

Use the same modal/dialog and button components that are already used in other parts of the FormBuilder for consistency.

4. Marking steps/fields as reusable in the editor
Update the step and field edit UIs so that the user can decide which ones become reusable templates:

For each step editor:

Add a checkbox/toggle: “Mark this step as reusable template”.

Bind it to step.isReusable.

Ensure that this property is sent to the backend when saving the configuration.

For each field editor:

Add a checkbox/toggle: “Mark this field as reusable template”.

Bind it to field.isReusable.

Ensure that this property is included in the DTO when saving.

Where appropriate, visually distinguish templates vs normal instances, for example:

An icon or badge on steps/fields that have isReusable === true.

A small indicator for items that are linked to a source template (isLinkedToSource === true vs false).

Make sure the UI updates correctly when:

A new configuration is loaded (data from API).

A configuration is saved and reloaded.

5. Compatibility / validation feedback in the UI
Even if the backend currently only returns a summary error when saving, the frontend must be ready to display per-step and per-field compatibility issues as soon as the DTO properties are populated.

Implement the following:

In the state model / components that render steps/fields:

React to hasCompatibilityIssues on both FormStepDto and FormFieldDto.

If hasCompatibilityIssues is true, render a visual warning (e.g., red border, warning icon) next to that step/field.

If step.stepLevelIssues exists and has entries:

Show them via a tooltip or inline error area under the step header.

If field.compatibilityIssues exists and has entries:

Show a tooltip and/or inline list of messages for that field.

When a save of the entire FormConfiguration fails because the backend validation fails (InvalidOperationException):

Show the summary message returned by the backend (e.g., “FormConfiguration has 2 incompatible fields for entity 'Structure'.”) in a top-level alert/banner.

Do not clear the form; allow the user to fix the problematic steps/fields.

Make sure that the existing save/update flows for FormConfigurations call the backend and handle 400 errors gracefully (displaying the summary instead of crashing).

Do NOT implement heavy client-side re-validation that duplicates backend logic. The frontend may do light sanity checks, but the backend remains the single source of truth for template compatibility.

6. entityApiMapping / domain mapping adjustments
If there is any central mapping in src/utils/entityApiMapping.ts or similar that describes how FormConfiguration/FormStep/FormField DTOs are wired to APIs:

Extend it as needed to expose the new template-related API methods.

Keep it consistent with how other entity API mappings are defined.

Do not break existing mappings for other entities like Category, ItemType, etc.

7. Error handling and UX polish
Reuse the existing error handling utilities (e.g. centralized handleApiError, toast system, etc.).

For all new API calls:

Show a loading indicator while the request is in progress.

Disable the confirm buttons to prevent duplicate submissions.

On error, surface a concise, user-friendly message, falling back to a generic error if the backend message is missing.

8. Acceptance criteria
The changes are complete when:

In the FormBuilder:

“Add step from template” shows a template selection modal, allows choosing copy/link, and successfully adds a step via the backend.

“Add field from template” does the same for fields.

Steps and fields can be marked as reusable via toggles, and this is persisted.

Linked templates are visually distinguishable from copied instances.

If the backend rejects saving a FormConfiguration due to template compatibility issues, the user sees:

A clear top-level error message.

Visual warnings on any steps/fields that have hasCompatibilityIssues === true when those flags are present in the DTOs.

All new code follows the existing patterns in the repo:

Same API client structure.

Same DTO naming/style.

No TypeScript errors.

Existing FormBuilder behavior for non-template use cases continues to work.

Please implement these changes step by step, reusing and refactoring existing code where possible instead of duplicating logic.