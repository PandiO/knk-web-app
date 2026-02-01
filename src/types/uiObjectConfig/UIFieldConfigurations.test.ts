import { mapApiToUIObjectConfigDto } from './UIFieldConfigurations';

describe('Mapping Functions', () => {
  test('should correctly map API object to UI object config DTO', () => {
    const apiObject = {
        "Id": 9,
        "ObjectType": "Location",
        "Title": "Location",
        "LayoutStyle": "tabs",
        "FieldGroups": [
            {
                "Id": 11,
                "UIObjectConfigId": 9,
                "Name": "Coordinates",
                "Label": "Coordinates",
                "Order": 0,
                "Fields": [
                    {
                        "Id": 11,
                        "Name": "X",
                        "Label": "X",
                        "Type": "Number",
                        "Required": true,
                        "DefaultValue": null,
                        "Placeholder": "",
                        "Validations": [],
                        "ReferenceObjectType": null,
                        "Order": 0,
                        "ComponentType": ""
                    },
                    {
                        "Id": 12,
                        "Name": "Y",
                        "Label": "Y",
                        "Type": "Number",
                        "Required": true,
                        "DefaultValue": null,
                        "Placeholder": "",
                        "Validations": [],
                        "ReferenceObjectType": null,
                        "Order": 0,
                        "ComponentType": ""
                    },
                    {
                        "Id": 13,
                        "Name": "Z",
                        "Label": "Z",
                        "Type": "Number",
                        "Required": true,
                        "DefaultValue": null,
                        "Placeholder": "",
                        "Validations": [],
                        "ReferenceObjectType": null,
                        "Order": 0,
                        "ComponentType": ""
                    },
                    {
                        "Id": 14,
                        "Name": "World",
                        "Label": "World Name",
                        "Type": "Text",
                        "Required": true,
                        "DefaultValue": "world",
                        "Placeholder": "",
                        "Validations": [],
                        "ReferenceObjectType": null,
                        "Order": 0,
                        "ComponentType": ""
                    },
                    {
                        "Id": 15,
                        "Name": "Yaw",
                        "Label": "Yaw",
                        "Type": "Number",
                        "Required": true,
                        "DefaultValue": null,
                        "Placeholder": "",
                        "Validations": [],
                        "ReferenceObjectType": null,
                        "Order": 0,
                        "ComponentType": ""
                    },
                    {
                        "Id": 16,
                        "Name": "Pitch",
                        "Label": "Pitch",
                        "Type": "Number",
                        "Required": true,
                        "DefaultValue": null,
                        "Placeholder": "",
                        "Validations": [],
                        "ReferenceObjectType": null,
                        "Order": 0,
                        "ComponentType": ""
                    }
                ]
            }
        ],
        "Fields": []
    };

    const expectedUIObjectConfigDto = {
        "id": 9,
        "objectType": "Location",
        "title": "Location",
        "layoutStyle": "tabs",
        "fieldGroups": [
            {
                "id": 11,
                "uiObjectConfigId": 9,
                "name": "Coordinates",
                "label": "Coordinates",
                "order": 0,
                "fields": [
                    {
                        "id": 11,
                        "name": "X",
                        "label": "X",
                        "type": "Number",
                        "required": true,
                        "defaultValue": null,
                        "placeholder": "",
                        "referenceObjectType": null,
                        "order": 0,
                        "componentType": "",
                        "validations": []
                    },
                    {
                        "id": 12,
                        "name": "Y",
                        "label": "Y",
                        "type": "Number",
                        "required": true,
                        "defaultValue": null,
                        "placeholder": "",
                        "referenceObjectType": null,
                        "order": 0,
                        "componentType": "",
                        "validations": []
                    },
                    {
                        "id": 13,
                        "name": "Z",
                        "label": "Z",
                        "type": "Number",
                        "required": true,
                        "defaultValue": null,
                        "placeholder": "",
                        "referenceObjectType": null,
                        "order": 0,
                        "componentType": "",
                        "validations": []
                    },
                    {
                        "id": 14,
                        "name": "World",
                        "label": "World Name",
                        "type": "Text",
                        "required": true,
                        "defaultValue": "world",
                        "placeholder": "",
                        "referenceObjectType": null,
                        "order": 0,
                        "componentType": "",
                        "validations": []
                    },
                    {
                        "id": 15,
                        "name": "Yaw",
                        "label": "Yaw",
                        "type": "Number",
                        "required": true,
                        "defaultValue": null,
                        "placeholder": "",
                        "referenceObjectType": null,
                        "order": 0,
                        "componentType": "",
                        "validations": []
                    },
                    {
                        "id": 16,
                        "name": "Pitch",
                        "label": "Pitch",
                        "type": "Number",
                        "required": true,
                        "defaultValue": null,
                        "placeholder": "",
                        "referenceObjectType": null,
                        "order": 0,
                        "componentType": "",
                        "validations": []
                    }
                ]
            }
        ],
        "fields": []
    };

    const result = mapApiToUIObjectConfigDto(apiObject);
    expect(result).toEqual(expectedUIObjectConfigDto);
  });

  // Additional test cases for edge cases and other mapping functions
  test('should handle empty API object', () => {
    const apiObject = {};
    const expectedUIObjectConfigDto = {
      // Expected result for empty API object
      id: undefined,
      displayName: undefined,
      // other properties...
    };

    const result = mapApiToUIObjectConfigDto(apiObject);
    expect(result).toEqual(expectedUIObjectConfigDto);
  });

  // Add more tests as necessary
});