import { buildPlaceholderContext, extractPlaceholders, placeholderDisplayValue } from "../placeholderExtraction";
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
            steps: [
                {
                    stepName: "Step 1",
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
            steps: [
                {
                    stepName: "Step 1",
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
            steps: [
                {
                    stepName: "Step 1",
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
            steps: [
                {
                    stepName: "Step 1",
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

describe("placeholderDisplayValue (KNG-173)", () => {
    it("uses the display name of a relationship object", () => {
        expect(placeholderDisplayValue({ id: 4, name: "Old Town" })).toBe("Old Town");
        expect(placeholderDisplayValue({ Id: 4, Name: "Main Street" })).toBe("Main Street");
        expect(placeholderDisplayValue({ id: 4, displayName: "Iron Gate" })).toBe("Iron Gate");
        expect(placeholderDisplayValue({ id: 4, title: "Quest" })).toBe("Quest");
    });

    it("falls back to the id when the object has no name", () => {
        expect(placeholderDisplayValue({ id: 12 })).toBe("12");
        expect(placeholderDisplayValue({ Id: 7, name: "" })).toBe("7");
        expect(placeholderDisplayValue({ x: 1, y: 2 })).toBe("");
    });

    it("joins the names of an array", () => {
        expect(placeholderDisplayValue([{ id: 1, name: "North" }, { id: 2 }, null, "South"])).toBe("North, 2, South");
        expect(placeholderDisplayValue([])).toBe("");
    });

    it("turns null and undefined into an empty string and keeps scalars", () => {
        expect(placeholderDisplayValue(null)).toBe("");
        expect(placeholderDisplayValue(undefined)).toBe("");
        expect(placeholderDisplayValue(42)).toBe("42");
        expect(placeholderDisplayValue(false)).toBe("false");
        expect(placeholderDisplayValue("York")).toBe("York");
    });

    it("never yields [object Object] in the form placeholders", () => {
        const field = (fieldName: string, order: number) => ({
            fieldName,
            label: fieldName,
            fieldType: FieldType.Object,
            isRequired: false,
            isReadOnly: false,
            order,
            isReusable: false,
            isLinkedToSource: false,
            hasCompatibilityIssues: false,
            validations: []
        });
        const config: FormConfigurationDto = {
            entityTypeName: "Structure",
            configurationName: "Structure Config",
            isDefault: true,
            steps: [
                {
                    stepName: "Step 1",
                    order: 0,
                    isReusable: false,
                    isLinkedToSource: false,
                    hasCompatibilityIssues: false,
                    isManyToManyRelationship: false,
                    childFormSteps: [],
                    fields: [field("DistrictId", 0), field("StreetId", 1), field("Tags", 2)],
                    conditions: []
                }
            ]
        };

        const placeholders = buildPlaceholderContext(config, {
            0: { DistrictId: { id: 3, name: "Harbour" }, StreetId: { id: 9 }, Tags: [{ name: "a" }, { name: "b" }] }
        });

        expect(placeholders).toEqual({ DistrictId: "Harbour", StreetId: "9", Tags: "a, b" });
    });
});
