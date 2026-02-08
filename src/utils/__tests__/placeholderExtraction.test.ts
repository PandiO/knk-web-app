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
});
