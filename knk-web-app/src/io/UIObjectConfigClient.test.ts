import { UIObjectConfigClient } from "./UIObjectConfigClient";
import { HttpMethod, Controllers, UIObjectConfigurationOperation } from "../utils/enums";
import { UIObjectConfigDto } from "../utils/domain/dto/uiObjectConfig/UIFieldConfigurations";
import { uiConfigApiTestData, uiConfigTestData } from "../data/testData";
import { mapApiToUIObjectConfigDto } from "../utils/domain/dto/uiObjectConfig/mappers";

jest.mock("./objectManager");

describe("UIObjectConfigClient", () => {
    let client: UIObjectConfigClient;

    beforeEach(() => {
        client = UIObjectConfigClient.getInstance();
    });

    it("should be a singleton", () => {
        const anotherInstance = UIObjectConfigClient.getInstance();
        expect(client).toBe(anotherInstance);
    });

    it("should fetch all UI object configurations", async () => {
        const mockResponse: UIObjectConfigDto[] = uiConfigApiTestData.map(mapApiToUIObjectConfigDto);
        jest.spyOn(client, "invokeServiceCall").mockResolvedValue(uiConfigApiTestData);

        const result = await client.getAll();
        expect(client.invokeServiceCall).toHaveBeenCalledWith(
            null,
            UIObjectConfigurationOperation.GetAll,
            Controllers.UIObjectConfigurations,
            HttpMethod.Post
        );
        expect(result).toEqual(mockResponse);
    });

    it("should fetch a specific UI object configuration by type", async () => {
        const apiObject = uiConfigApiTestData[0];
        const mockResponse: UIObjectConfigDto = mapApiToUIObjectConfigDto(apiObject);
        jest.spyOn(client, "invokeServiceCall").mockResolvedValue(apiObject);

        const result = await client.getByType("type1");
        expect(client.invokeServiceCall).toHaveBeenCalledWith(
            "type1",
            UIObjectConfigurationOperation.GetByType,
            Controllers.UIObjectConfigurations,
            HttpMethod.Get
        );
        expect(result).toEqual(mockResponse);
    });

    it("should create a new UI object configuration", async () => {
        const apiObject: any = uiConfigApiTestData[1];
        const newConfig: UIObjectConfigDto = mapApiToUIObjectConfigDto(apiObject);
        jest.spyOn(client, "invokeServiceCall").mockResolvedValue(apiObject);

        const result = await client.create(newConfig);
        expect(client.invokeServiceCall).toHaveBeenCalledWith(
            newConfig,
            UIObjectConfigurationOperation.Create,
            Controllers.UIObjectConfigurations,
            HttpMethod.Post
        );
        expect(result).toEqual(newConfig);
    });

    it("should update an existing UI object configuration", async () => {
        const updatedConfig: UIObjectConfigDto = uiConfigTestData[2];
        jest.spyOn(client, "invokeServiceCall").mockResolvedValue(updatedConfig);

        const result = await client.update(updatedConfig);
        expect(client.invokeServiceCall).toHaveBeenCalledWith(
            updatedConfig,
            UIObjectConfigurationOperation.Update,
            Controllers.UIObjectConfigurations,
            HttpMethod.Put
        );
        expect(result).toEqual(updatedConfig);
    });

    it("should delete a UI object configuration by ID", async () => {
        jest.spyOn(client, "invokeServiceCall").mockResolvedValue(undefined);

        await client.delete(1);
        expect(client.invokeServiceCall).toHaveBeenCalledWith(
            1,
            UIObjectConfigurationOperation.Delete,
            Controllers.UIObjectConfigurations,
            HttpMethod.Delete
        );
    });
});