import {
  mapToFrontendModel,
  mapToDto,
} from "./mappers";
import { UIObjectConfigDto } from "./domain/dto/UIFieldConfigurations";

describe("Mapping Functions", () => {
  it("should map API DTO to frontend model correctly", () => {
    const apiDto: UIObjectConfigDto = {
      ObjectType: "TestType",
      Title: "Test Title",
      LayoutStyle: "standard",
      FieldGroups: [
        {
          Name: "Group1",
          Label: "Group 1",
          Order: 1,
          Fields: [
            {
              Name: "Field1",
              Label: "Field 1",
              Type: "Text",
              Required: true,
              DefaultValue: "Default",
              Placeholder: "Enter text",
              ReferenceObjectType: "ObjectType",
              Order: 1,
              ComponentType: "Input",
              Validations: [
                { Type: "Required", Value: "true" },
              ],
            },
          ],
        },
      ],
      Fields: [],
    };

    const frontendModel = mapToFrontendModel(apiDto);
    expect(frontendModel.objectType).toBe("TestType");
    expect(frontendModel.fieldGroups[0].fields[0].name).toBe("Field1");
  });

  it("should map frontend model to API DTO correctly", () => {
    const frontendModel = {
      objectType: "TestType",
      title: "Test Title",
      layoutStyle: "standard",
      fieldGroups: [
        {
          name: "Group1",
          label: "Group 1",
          order: 1,
          fields: [
            {
              name: "Field1",
              label: "Field 1",
              type: "Text",
              required: true,
              defaultValue: "Default",
              placeholder: "Enter text",
              referenceObjectType: "ObjectType",
              order: 1,
              componentType: "Input",
              validations: [
                { type: "Required", value: "true" },
              ],
            },
          ],
        },
      ],
      fields: [],
    };

    const apiDto = mapToDto(frontendModel);
    expect(apiDto.ObjectType).toBe("TestType");
    expect(apiDto.FieldGroups[0].Fields[0].Name).toBe("Field1");
  });
});
