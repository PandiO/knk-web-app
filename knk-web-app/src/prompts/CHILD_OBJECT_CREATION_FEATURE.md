# Child Object Creation Feature Implementation Summary

## Overview
Implemented a feature allowing users to create new object instances on-the-fly while filling out forms, without leaving the parent form. When creating child objects, they are saved as child progress records linked to the parent progress, and their data is inserted back into the parent form field.

## Changes Made

### 1. FormFieldDto - Added `canCreate` Field
**File:** `src/utils/domain/dto/forms/FormModels.ts`

Added a new optional boolean property to `FormFieldDto`:
```typescript
canCreate?: boolean; // whether user can create new instances on-the-fly for Object/List fields
```

**Default Behavior:** If not specified, defaults to `true` (can create)

---

### 2. ObjectField Component - Conditional "Create New" Button
**File:** `src/components/FormWizard/FieldRenderers.tsx`

Updated `ObjectField` to:
- Check the `canCreate` field (defaults to `true`)
- Only show the "Create New" button when `canCreate` is `true` AND `onCreateNew` callback is provided
- Maintain all existing functionality for selecting from existing objects

```typescript
const canCreate = field.canCreate !== false; // default true if not specified
// ...
{onCreateNew && canCreate && (
    <button
        type="button"
        onClick={onCreateNew}
        className="btn-secondary whitespace-nowrap self-start"
    >
        <Plus className="h-4 w-4 mr-1" />
        Create New
    </button>
)}
```

---

### 3. New ChildFormModal Component
**File:** `src/components/FormWizard/ChildFormModal.tsx` (NEW)

A modal wrapper that:
- Loads the default form configuration for the target object type
- Shows an error feedback modal if no default configuration exists
- Renders a nested `FormWizard` instance for users to fill out the child object
- Handles completion and passes data back to the parent form
- Provides a clean modal interface with close button and header

**Key Features:**
- Automatically fetches default form configuration for the entity type
- Displays error feedback if configuration not found
- Overlay design prevents accidental interaction with parent form
- Clean header showing entity type being created

---

### 4. FormWizard Component - Child Form Support
**File:** `src/components/FormWizard/FormWizard.tsx`

#### Added Props to FormWizardProps Interface:
```typescript
parentProgressId?: string;    // for nested child forms
fieldName?: string;            // field name this child form is for
currentStepIndex?: number;     // step index where child form is being created
```

#### Added State for Child Form Modal:
```typescript
type ChildFormState = {
    open: boolean;
    entityTypeName: string;
    fieldName: string;
};
```

#### New Handler Functions:

1. **`handleOpenChildForm(field)`** - Opens the child form modal
   - Extracts object type from field
   - Sets up modal state with field information

2. **`handleCloseChildForm()`** - Closes the child form modal

3. **`handleChildFormComplete(childData)`** - Processes child form completion
   - If parent form exists (has `parentProgressId`):
     - Creates a new `FormSubmissionProgressDto` with `parentProgressId` set
     - Saves it to the backend via `formSubmissionClient.create()`
     - This creates a child progress record linked to parent
   - Inserts the completed child data into the parent form's current step
   - Closes the modal and handles errors gracefully

#### Updated FieldRenderer Call:
- Now passes `onCreateNew={() => handleOpenChildForm(field)}` callback
- This enables the "Create New" button in ObjectField

#### Added ChildFormModal to JSX:
- Positioned at the bottom of the component, alongside FeedbackModal
- Receives all necessary props for managing child form lifecycle

---

## Data Flow

### Creating a Child Object:

1. **User clicks "Create New" button** on an Object field (if `canCreate` is true)
2. **ChildFormModal opens** and loads default form config for that object type
3. **FormWizard renders** inside modal with empty initial state
4. **User fills out** the child form fields
5. **User submits** by clicking Submit/Next to final step
6. **Child data is sent** to parent's `handleChildFormComplete()`
7. **Parent creates progress record** with:
   - `parentProgressId` set to current progress ID
   - Status: `FormSubmissionStatus.Completed`
   - Child data in `currentStepDataJson`
8. **Backend stores** child progress linked to parent
9. **Data is inserted** into the parent form field (e.g., a single object selection field)
10. **Modal closes** and user continues with parent form

### Saving Draft with Child Objects:

- When parent form saves draft (`FormSubmissionStatus.Paused`):
  - Child progress records are already saved to backend
  - Parent can be resumed later and child objects are preserved
  - Child objects appear in the form field when parent resumes

### Completing Parent Form:

- When parent form is completed:
  - All child progress records remain in database with `parentProgressId` reference
  - Parent form data (including child object data) is sent to completion handler
  - Backend relationship is maintained for future auditing/tracking

---

## Error Handling

**No Default Configuration Found:**
- ChildFormModal displays error in FeedbackModal
- Shows user-friendly message: "No default form configuration found for {EntityType}"
- User is returned to parent form without disruption

**Failed to Save Child Progress:**
- Error is logged to console
- `logging.errorHandler.next()` is called for centralized error handling
- User sees modal close but data insertion still occurs (graceful fallback)

---

## Backend Requirements

The backend should support:

1. **FormFieldDto.canCreate Property:** 
   - Optional boolean field (defaults to true)
   - Can be set per field in form configurations

2. **FormSubmissionProgressDto.parentProgressId:**
   - Already exists in the current schema
   - Used to link child progress to parent

3. **Child Progress Retrieval:**
   - When loading parent progress, optionally load childProgresses array
   - Enables tracking of all child objects created during parent form

---

## Usage Example

### Form Configuration (Backend):

```json
{
  "entityTypeName": "Project",
  "steps": [
    {
      "fields": [
        {
          "fieldName": "managerId",
          "fieldType": "Object",
          "objectType": "Manager",
          "canCreate": true,      // Allow creating managers on-the-fly
          "isRequired": true
        },
        {
          "fieldName": "departmentId",
          "fieldType": "Object",
          "objectType": "Department",
          "canCreate": false      // Don't allow creating departments on-the-fly
        }
      ]
    }
  ]
}
```

### User Workflow:

1. User opens "Create Project" form
2. Form displays "Manager" field with "Create New" button (canCreate=true)
3. Form displays "Department" field without "Create New" button (canCreate=false)
4. User clicks "Create New" for Manager
5. Modal opens with Manager form
6. User fills out manager details and clicks Submit
7. Manager is created and automatically selected in the Project form
8. User continues filling out Project form
9. User cannot create departments on-the-fly, must select from existing list

---

## Future Enhancements

1. **List Field Support:**
   - Extend canCreate to List fields containing objects
   - Allow multiple child objects to be created and added to list

2. **Child Progress Updates:**
   - Support editing/updating child progress records
   - Link child data to parent through UI

3. **Cascading Child Forms:**
   - Allow child forms to have their own child forms (multi-level nesting)

4. **Bulk Child Creation:**
   - Create multiple child objects in sequence without returning to parent

---

## Files Modified

| File | Changes |
|------|---------|
| `src/utils/domain/dto/forms/FormModels.ts` | Added `canCreate` property to FormFieldDto |
| `src/components/FormWizard/FieldRenderers.tsx` | Updated ObjectField to check `canCreate` and conditionally show button |
| `src/components/FormWizard/FormWizard.tsx` | Added child form state, handlers, and ChildFormModal integration |
| `src/components/FormWizard/ChildFormModal.tsx` | NEW: Modal wrapper for nested form creation |

---

## Testing Checklist

- [ ] Verify "Create New" button appears when `canCreate=true`
- [ ] Verify "Create New" button hidden when `canCreate=false`
- [ ] Verify child form opens in modal when button clicked
- [ ] Verify error feedback shows when no default config exists
- [ ] Verify child data is inserted into parent field on completion
- [ ] Verify child progress is saved with `parentProgressId`
- [ ] Verify parent form can continue after child creation
- [ ] Verify draft save preserves child objects
- [ ] Verify form completion includes child object data
- [ ] Verify error handling for failed child save operations
