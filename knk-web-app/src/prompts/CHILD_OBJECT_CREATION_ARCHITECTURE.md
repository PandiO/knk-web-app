# Child Object Creation Feature - Architecture Diagram

## Component Interaction Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      FormWizardPage                              │
│                    (Parent Container)                            │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  FormWizard (Parent Form)                                │   │
│  │  - entityName: "Project"                                 │   │
│  │  - userId: "123"                                         │   │
│  │  - progressId: "parent-123"                              │   │
│  │                                                           │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │  Current Step Fields                               │  │   │
│  │  │                                                    │  │   │
│  │  │  ┌──────────────────────────────────────────────┐ │  │   │
│  │  │  │  Manager Field (ObjectField)                 │ │  │   │
│  │  │  │  canCreate: true                             │ │  │   │
│  │  │  │  objectType: "Manager"                       │ │  │   │
│  │  │  │                                              │ │  │   │
│  │  │  │  [Select from Table]  [Create New ✓]        │ │  │   │
│  │  │  │         ↓                    ↓               │ │  │   │
│  │  │  │    Existing Mgrs        onClick →────────┐  │ │  │   │
│  │  │  │    - Alice              handleOpen      │  │ │  │   │
│  │  │  │    - Bob              ChildForm()       │  │ │  │   │
│  │  │  │                                          │  │ │  │   │
│  │  │  └──────────────────────────────────────────┘ │  │   │
│  │  │                                                │  │   │
│  │  │  ┌──────────────────────────────────────────┐ │  │   │
│  │  │  │  Department Field (ObjectField)          │ │  │   │
│  │  │  │  canCreate: false                        │ │  │   │
│  │  │  │  objectType: "Department"                │ │  │   │
│  │  │  │                                          │ │  │   │
│  │  │  │  [Select from Table]  (no button)        │ │  │   │
│  │  │  │    - HR Dept                             │ │  │   │
│  │  │  │    - Eng Dept                            │ │  │   │
│  │  │  │                                          │ │  │   │
│  │  │  └──────────────────────────────────────────┘ │  │   │
│  │  │                                                │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  │                                                       │   │
│  │  [Previous]  [Save Draft]  [Next/Submit]            │   │
│  │                                                       │   │
│  └──────────────────────────────────────────────────────┘   │
│                          ▲                                    │
│                          │                                    │
│         ┌────────────────┘                                    │
│         │                                                     │
│    6. Child data                                              │
│    inserted                                                   │
│                                                               │
└─────────────────────────────────────────────────────────────────┘
                          │
                          │ 1. Click "Create New"
                          │
                          ▼
    ┌──────────────────────────────────────────────────────────┐
    │         ChildFormModal (Modal Overlay)                   │
    │  ┌────────────────────────────────────────────────────┐  │
    │  │                                                    │  │
    │  │  [×] Create New Manager                           │  │
    │  │      Fill in the form to create a new Manager     │  │
    │  │                                                    │  │
    │  │  ┌──────────────────────────────────────────────┐ │  │
    │  │  │  FormWizard (Child Form)                     │ │  │
    │  │  │  - entityName: "Manager"                     │ │  │
    │  │  │  - userId: "123"                             │ │  │
    │  │  │  - parentProgressId: "parent-123" ← NEW      │ │  │
    │  │  │  - fieldName: "managerId" ← NEW              │ │  │
    │  │  │                                              │ │  │
    │  │  │  ┌──────────────────────────────────────────┐ │  │
    │  │  │  │ Manager Form Fields                      │ │  │
    │  │  │  │ - Name: [________________]               │ │  │
    │  │  │  │ - Email: [________________]              │ │  │
    │  │  │  │ - Department: [Select from list]        │ │  │
    │  │  │  │                                          │ │  │
    │  │  │  └──────────────────────────────────────────┘ │  │
    │  │  │                                                │  │
    │  │  │  [Previous]  [Save Draft]  [Next/Submit]      │  │
    │  │  │                                                │  │
    │  │  └────────────────────────────────────────────────┘ │  │
    │  │                                                    │  │
    │  └────────────────────────────────────────────────────┘  │
    │                                                           │
    │                                                           │
    │  2. Load default       3. User fills out      4. Submit  │
    │     Manager form          child form           and save  │
    │                                                           │
    └──────────────────────────────────────────────────────────┘
                          ▲
                          │ 5. handleChildFormComplete()
                          │    - Create progress with
                          │      parentProgressId
                          │    - Save to backend
                          │    - Insert data in field


## Data Structure

### Parent Progress (Being Created)
```typescript
{
  id: "parent-123",
  formConfigurationId: "project-config-1",
  userId: "123",
  entityTypeName: "Project",
  currentStepIndex: 0,
  currentStepDataJson: {
    managerId: {        // ← Child data inserted here
      id: "mgr-456",
      name: "John Doe",
      email: "john@company.com"
    },
    departmentId: "dept-789",
    ...
  },
  allStepsDataJson: { /* full form state */ },
  status: "InProgress",
  parentProgressId: null  // null = this is parent
}
```

### Child Progress (Created by child form)
```typescript
{
  id: "child-456",  // ← New progress created
  formConfigurationId: "manager-config-1",
  userId: "123",
  entityTypeName: "Manager",
  currentStepIndex: 0,
  currentStepDataJson: {
    name: "John Doe",
    email: "john@company.com",
    department: "dept-789"
  },
  allStepsDataJson: { /* full form state */ },
  parentProgressId: "parent-123",  // ← Links to parent
  status: "Completed"
}
```

## Event Sequence

```
User                 FieldRenderer           FormWizard            ChildFormModal          Backend
│                       │                         │                      │                    │
├─ Click "Create New"──→ │                         │                      │                    │
│                       ├─ onCreateNew()──────────→│                      │                    │
│                       │                         ├─ handleOpen()        │                    │
│                       │                         ├─ setState────────────→│                    │
│                       │                         │                      ├─ Load default
│                       │                         │                      │  config────────────→│
│                       │                         │                      │                    ├─ Fetch config
│                       │                         │                      │←─────────────────────┤
│                       │                         │←─ Show modal          │                    │
│                       │                         │                      │ Render FormWizard   │
│                       │                         │                      │                    │
├─ Fill form──────────────────────────────────────────────────────────→ │                    │
│                       │                         │                      │                    │
├─ Click Submit──────────────────────────────────────────────────────→ │                    │
│                       │                         │                      │                    │
│                       │                         ├─ validate()           │                    │
│                       │                         ├─ Complete child form  │                    │
│                       │                         ├─ handleComplete()    │                    │
│                       │                         ├─ Create progress────────────────────────→│
│                       │                         │                      │                    ├─ Save child
│                       │                         │←───────────────────────────────────────────┤
│                       │                         ├─ setState            │                    │
│                       │                         │   [insert data]       │                    │
│                       │                         ├─ Close modal ────────→│                    │
│                       │                         │  (modal closes)       │                    │
│                       │←─ [Child data]──────────┤                      │                    │
│←─ Show child data─────┤                         │                      │                    │
│                       │                         │                      │                    │
├─ Continue form───────→ │                         │                      │                    │
│                       │                         │                      │                    │
├─ Click Submit──────────────────────────────────→ │                      │                    │
│                       │                         ├─ Final submit─────────────────────────────→│
│                       │                         │                      │                    ├─ Save parent
│                       │                         │                      │                    │  with child ref
│                       │                         │                      │                    │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

## File Dependencies

```
FormWizardPage
    │
    ├── imports → FormWizard
    │
    └── FormWizard
        │
        ├── imports → FieldRenderers
        │   │
        │   └── FieldRenderer
        │       │
        │       ├── StringField
        │       ├── IntegerField
        │       ├── ObjectField ← Uses canCreate
        │       ├── ListField
        │       └── ... other field types
        │
        ├── imports → ChildFormModal ← NEW
        │   │
        │   ├── Internally imports → FormWizard (recursive)
        │   └── Internally imports → FeedbackModal
        │
        ├── imports → FeedbackModal
        ├── imports → formSubmissionClient (save child progress)
        └── imports → formConfigClient (load configs)

FormModels.ts
    │
    └── FormFieldDto ← Added canCreate property
```

## State Management Flow

### Parent FormWizard State
```
┌─────────────────────────────────┐
│  FormWizard State               │
├─────────────────────────────────┤
│ • currentStepIndex              │
│ • currentStepData               │
│ • allStepsData                  │
│ • errors                        │
│ • saveFeedback                  │
│ • childFormModal ← NEW          │
│   ├─ open: boolean              │
│   ├─ entityTypeName: string     │
│   └─ fieldName: string          │
└─────────────────────────────────┘
```

### Child FormWizard State (inside ChildFormModal)
```
┌──────────────────────────────────┐
│  Child FormWizard State          │
├──────────────────────────────────┤
│ • currentStepIndex               │
│ • currentStepData                │
│ • allStepsData                   │
│ • errors                         │
│ • saveFeedback                   │
│ • progressId (if resuming)       │
│ • parentProgressId ← from props   │
│ • fieldName ← from props          │
│ • userId ← from props             │
└──────────────────────────────────┘
```

## Error Handling Paths

```
User clicks "Create New"
    │
    ├─ ChildFormModal opens
    │   │
    │   └─ Load default config
    │       │
    │       ├─ SUCCESS → Show FormWizard
    │       │
    │       └─ FAILURE → Show error FeedbackModal
    │           │
    │           ├─ Error message: "No default form configuration found"
    │           └─ onClose → Return to parent form
    │
    └─ User fills form and submits
        │
        ├─ Child FormWizard validates
        │   │
        │   ├─ INVALID → Show errors
        │   │
        │   └─ VALID → handleComplete()
        │       │
        │       └─ Save to backend
        │           │
        │           ├─ SUCCESS → Insert data & close modal
        │           │
        │           └─ FAILURE → Log error & close gracefully
        │               │
        │               └─ logging.errorHandler.next()
```
