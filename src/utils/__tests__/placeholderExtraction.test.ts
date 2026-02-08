import { buildPlaceholderContext, extractPlaceholders } from "../placeholderExtraction";
import { AllStepsData, FormConfigurationDto } from "../../types/dtos/forms/FormModels";
import { FieldType } from "../../utils/enums";

describe("extractPlaceholders", () => {
    it("extracts placeholders from message", () => {
        const placeholders = extractPlaceholders("Hello {Name} from {Town.Name}");
        expect(placeholders).toEqual(["Name", "Town.Name"]);
    });

    it("returns empty array when no placeholders exist", () => {
        const placeholders = extractPlaceholders("Hello world");
        expect(placeholders).toEqual([]);
    });
});

describe("buildPlaceholderContext", () => {
    it("builds placeholders from step data", () => {
        const config: FormConfigurationDto = {
            entityTypeName: "District",
            configurationName: "District Config",
            isDefault: true,
            isActive: true,
            steps: [
                {
                    stepName: "Step 1",
                    title: "Basics",
                    order: 0,
                    isReusable: false,
                    isLinkedToSource: false,
                    hasCompatibilityIssues: false,
                    isManyToManyRelationship: false,
                    childFormSteps: [],
                    fields: [
                        {
                            fieldName: "Name",
                            label: "Name",
                            fieldType: FieldType.String,
                            isRequired: true,
                            isReadOnly: false,
                            order: 0,
                            isReusable: false,
                            isLinkedToSource: false,
                            hasCompatibilityIssues: false,
                            validations: []
                        },
                        {
                            fieldName: "Description",
                            label: "Description",
                            fieldType: FieldType.String,
                            isRequired: false,
                            isReadOnly: false,
                            order: 1,
                            isReusable: false,
                            isLinkedToSource: false,
                            hasCompatibilityIssues: false,
                            validations: []
                        }
                    ],
                    conditions: []
                }
            ]
        };

        const allStepsData: AllStepsData = {
            0: {
                Name: "York",
                Description: null
            }
        };

        const placeholders = buildPlaceholderContext(config, allStepsData);
        expect(placeholders).toEqual({ Name: "York" });
    });

    it("builds placeholders from multi-step form", () => {
        const config: FormConfigurationDto = {
            entityTypeName: "Structure",
            configurationName: "Structure Config",
            isDefault: true,
            isActive: true,
            steps: [
                {
                    stepName: "Step 1",
                    title: "Basic Info",
                    order: 0,
                    isReusable: false,
                    isLinkedToSource: false,
                    hasCompatibilityIssues: false,
                    isManyToManyRelationship: false,
                    childFormSteps: [],
                    fields: [
                        {
                            fieldName: "Name",
                            label: "Name",
                            fieldType: FieldType.String,
                            isRequired: true,
                            isReadOnly: false,
                            order: 0,
                            isReusable: false,
                            isLinkedToSource: false,
                            hasCompatibilityIssues: false,
                            validations: []
                        }
                    ],
                    conditions: []
                },
                {
                    stepName: "Step 2",
                    title: "Details",
                    order: 1,
                    isReusable: false,
                    isLinkedToSource: false,
                    hasCompatibilityIssues: false,
                    isManyToManyRelationship: false,
                    childFormSteps: [],
                    fields: [
                        {
                            fieldName: "Type",
                            label: "Type",
                            fieldType: FieldType.String,
                            isRequired: false,
                            isReadOnly: false,
                            order: 0,
                            isReusable: false,
                            isLinkedToSource: false,
                            hasCompatibilityIssues: false,
                            validations: []
                        }
                    ],
                    conditions: []
                }
            ]
        };

        const allStepsData: AllStepsData = {
            0: { Name: "Town Hall" },
            1: { Type: "Government" }
        };

        const placeholders = buildPlaceholderContext(config, allStepsData);
        expect(placeholders).toEqual({ Name: "Town Hall", Type: "Government" });
    });

    it("skips null and undefined values", () => {
        const config: FormConfigurationDto = {
            entityTypeName: "District",
            configurationName: "District Config",
            isDefault: true,
            isActive: true,
            steps: [
                {
                    stepName: "Step 1",
                    title: "Basics",
                    order: 0,
                    isReusable: false,
                    isLinkedToSource: false,
                    hasCompatibilityIssues: false,
                    isManyToManyRelationship: false,
                    childFormSteps: [],
                    fields: [
                        {
                            fieldName: "Name",
                            label: "Name",
                            fieldType: FieldType.String,
                            isRequired: true,
                            isReadOnly: false,
                            order: 0,
                            isReusable: false,
                            isLinkedToSource: false,
                            hasCompatibilityIssues: false,
                            validations: []
                        },
                        {
                            fieldName: "Description",
                            label: "Description",
                            fieldType: FieldType.String,
                            isRequired: false,
                            isReadOnly: false,
                            order: 1,
                            isReusable: false,
                            isLinkedToSource: false,
                            hasCompatibilityIssues: false,
                            validations: []
                        },
                        {
                            fieldName: "Notes",
                            label: "Notes",
                            fieldType: FieldType.String,
                            isRequired: false,
                            isReadOnly: false,
                            order: 2,
                            isReusable: false,
                            isLinkedToSource: false,
                            hasCompatibilityIssues: false,
                            validations: []
                        }
                    ],
                    conditions: []
                }
            ]
        };

        const allStepsData: AllStepsData = {
            0: {
                Name: "York",
                Description: null,
                Notes: undefined
            }
        };

        const placeholders = buildPlaceholderContext(config, allStepsData);
        // Should only include non-null values
        expect(placeholders).toEqual({ Name: "York" });
        expect(placeholders.Description).toBeUndefined();
        expect(placeholders.Notes).toBeUndefined();
    });

    it("handles missing step data gracefully", () => {
        const config: FormConfigurationDto = {
            entityTypeName: "District",
            configurationName: "District Config",
            isDefault: true,
            isActive: true,
            steps: [
                {
                    stepName: "Step 1",
                    title: "Basics",
                    order: 0,
                    isReusable: false,
                    isLinkedToSource: false,
                    hasCompatibilityIssues: false,
                    isManyToManyRelationship: false,
                    childFormSteps: [],
                    fields: [
                        {
                            fieldName: "Name",
                            label: "Name",
                            fieldType: FieldType.String,
                            isRequired: true,
                            isReadOnly: false,
                            order: 0,
                            isReusable: false,
                            isLinkedToSource: false,
                            hasCompatibilityIssues: false,
                            validations: []
                        }
                    ],
                    conditions: []
                },
                {
                    stepName: "Step 2",
                    title: "Details",
                    order: 1,
                    isReusable: false,
                    isLinkedToSource: false,
                    hasCompatibilityIssues: false,
                    isManyToManyRelationship: false,
                    childFormSteps: [],
                    fields: [
                        {
                            fieldName: "Type",
                            label: "Type",
                            fieldType: FieldType.String,
                            isRequired: false,
                            isReadOnly: false,
                            order: 0,
                            isReusable: false,
                            isLinkedToSource: false,
                            hasCompatibilityIssues: false,
                            validations: []
                        }
                    ],
                    conditions: []
                }
            ]
        };

        const allStepsData: AllStepsData = {
            0: { Name: "York" }
            // Step 1 data is missing
        };

        const placeholders = buildPlaceholderContext(config, allStepsData);
        // Should only extract data from step 0
        expect(placeholders).toEqual({ Name: "York" });
    });
});
