import { uiConfigApiTestData } from "../../../../data/testData";
import { mapApiToUIObjectConfigDto } from "./mappers";
import { UIObjectConfigDto } from "./UIFieldConfigurations";

describe("Mapping Functions", () => {
  it("should map API DTO to frontend model correctly", () => {
    const apiDto: any = uiConfigApiTestData[0];

    const frontendModel = mapApiToUIObjectConfigDto(apiDto);
    expect(frontendModel.objectType).toBe("type1");
    expect(frontendModel.fieldGroups?.[0]?.fields?.[0]?.name).toBe("Field 1");
  });
});
