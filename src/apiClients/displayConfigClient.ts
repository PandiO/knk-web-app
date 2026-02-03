import { logging, Controllers, HttpMethod, DisplayConfigurationOperation } from "../utils";
import { ObjectManager } from "./objectManager";
import {
  DisplayConfigurationDto,
  DisplaySectionDto,
  DisplayFieldDto,
  ReuseLinkMode,
  AddReusableSectionRequestDto,
  AddReusableFieldRequestDto
} from '../types/dtos/displayConfig/DisplayModels';

export class DisplayConfigClient extends ObjectManager {
  private static instance: DisplayConfigClient;

  public static getInstance() {
    if (!DisplayConfigClient.instance) {
      DisplayConfigClient.instance = new DisplayConfigClient();
      DisplayConfigClient.instance.logger = logging.getLogger("DisplayConfigClient");
    }
    return DisplayConfigClient.instance;
  }

  // ===== DISPLAYCONFIGURATIONS ENDPOINTS =====
  
  /**
   * Get all display configurations
   */
  async getAll(includeDrafts: boolean = true): Promise<DisplayConfigurationDto[]> {
    return this.invokeServiceCall({'includeDrafts': includeDrafts}, DisplayConfigurationOperation.GetAll, Controllers.DisplayConfigurations, HttpMethod.Get);
  }

  /**
   * Get display configuration by ID
   */
  async getById(id: number): Promise<DisplayConfigurationDto> {
    return this.invokeServiceCall(null, `${id}`, Controllers.DisplayConfigurations, HttpMethod.Get);
  }

  /**
   * Get default display configuration for entity type
   */
  getDefaultByEntityType(
    entityName: string,
    includeDrafts: boolean = false
  ): Promise<DisplayConfigurationDto> {
    return this.invokeServiceCall({ includeDrafts }, `${DisplayConfigurationOperation.GetByEntity}/${entityName}`, Controllers.DisplayConfigurations, HttpMethod.Get);
  }

  /**
   * Get all display configurations for entity type
   */
  async getAllByEntityType(
    entityName: string,
    includeDrafts: boolean = true
  ): Promise<DisplayConfigurationDto[]> {
    return this.invokeServiceCall({ includeDrafts }, `${DisplayConfigurationOperation.GetByEntityAll}/${entityName}`, Controllers.DisplayConfigurations, HttpMethod.Get);
  }

  /**
   * Get list of all entity type names with display configurations
   */
  async getEntityTypeNames(): Promise<string[]> {
    return this.invokeServiceCall(null, 'entity-names', Controllers.DisplayConfigurations, HttpMethod.Get);
  }

  /**
   * Create new display configuration (starts as draft)
   */
  async create(config: DisplayConfigurationDto): Promise<DisplayConfigurationDto> {
    return this.invokeServiceCall(config, '', Controllers.DisplayConfigurations, HttpMethod.Post);
  }

  /**
   * Update existing display configuration
   */
  async update(id: number, config: DisplayConfigurationDto): Promise<void> {
    return this.invokeServiceCall(config, `${DisplayConfigurationOperation.Update}/${id}`, Controllers.DisplayConfigurations, HttpMethod.Put);
  }

  /**
   * Delete display configuration
   */
  async delete(id: number): Promise<void> {
    return this.invokeServiceCall(null, `${DisplayConfigurationOperation.Delete}/${id}`, Controllers.DisplayConfigurations, HttpMethod.Delete);
  }

  /**
   * Publish display configuration (sets IsDraft = false after validation)
   */
  async publish(id: number): Promise<DisplayConfigurationDto> {
    return this.invokeServiceCall(null, `${id}/${DisplayConfigurationOperation.Publish}`, Controllers.DisplayConfigurations, HttpMethod.Post);
  }

  /**
   * Clone/copy configuration
   */
  async clone(id: number, linkMode: ReuseLinkMode): Promise<DisplayConfigurationDto> {
    return this.invokeServiceCall({ linkMode }, `${id}/${DisplayConfigurationOperation.Clone}`, Controllers.DisplayConfigurations, HttpMethod.Post);
  }

  // ===== DISPLAYSECTIONS ENDPOINTS =====

  /**
   * Get all reusable sections
   */
  async getAllReusableSections(): Promise<DisplaySectionDto[]> {
    return this.invokeServiceCall(null, 'reusable', Controllers.DisplaySections, HttpMethod.Get);
  }

  /**
   * Get section by ID
   */
  async getSectionById(id: number): Promise<DisplaySectionDto> {
    return this.invokeServiceCall(null, `${id}`, Controllers.DisplaySections, HttpMethod.Get);
  }

  /**
   * Create standalone reusable section
   */
  async createReusableSection(section: DisplaySectionDto): Promise<DisplaySectionDto> {
    return this.invokeServiceCall(section, 'reusable', Controllers.DisplaySections, HttpMethod.Post);
  }

  /**
   * Update section
   */
  async updateSection(id: number, section: DisplaySectionDto): Promise<void> {
    return this.invokeServiceCall(section, `${id}`, Controllers.DisplaySections, HttpMethod.Put);
  }

  /**
   * Delete section
   */
  async deleteSection(id: number): Promise<void> {
    return this.invokeServiceCall(null, `${id}`, Controllers.DisplaySections, HttpMethod.Delete);
  }

  /**
   * Clone/copy section
   */
  cloneSection(id: number, linkMode: ReuseLinkMode): Promise<DisplaySectionDto> {
    return this.invokeServiceCall({ linkMode }, `${id}/clone`, Controllers.DisplaySections, HttpMethod.Post);
  }

  // ===== DISPLAYFIELDS ENDPOINTS =====

  /**
   * Get all reusable fields
   */
  async getAllReusableFields(): Promise<DisplayFieldDto[]> {
    return this.invokeServiceCall(null, 'reusable', Controllers.DisplayFields, HttpMethod.Get);
  }

  /**
   * Get field by ID
   */
  async getFieldById(id: number): Promise<DisplayFieldDto> {
    return this.invokeServiceCall(null, `${id}`, Controllers.DisplayFields, HttpMethod.Get);
  }

  /**
   * Create standalone reusable field
   */
  async createReusableField(field: DisplayFieldDto): Promise<DisplayFieldDto> {
    return this.invokeServiceCall(field, 'reusable', Controllers.DisplayFields, HttpMethod.Post);
  }

  /**
   * Update field
   */
  async updateField(id: number, field: DisplayFieldDto): Promise<void> {
    return this.invokeServiceCall(field, `${id}`, Controllers.DisplayFields, HttpMethod.Put);
  }

  /**
   * Delete field
   */
  async deleteField(id: number): Promise<void> {
    return this.invokeServiceCall(null, `${id}`, Controllers.DisplayFields, HttpMethod.Delete);
  }

  /**
   * Clone/copy field
   */
  async cloneField(id: number, linkMode: ReuseLinkMode): Promise<DisplayFieldDto> {
    return this.invokeServiceCall({ linkMode }, `${id}/clone`, Controllers.DisplayFields, HttpMethod.Post);
  }

  // ===== TEMPLATE OPERATIONS (for builder) =====

  /**
   * Add reusable section to configuration
   */
  addReusableSectionToConfiguration(
    configId: string,
    payload: AddReusableSectionRequestDto
  ): Promise<DisplaySectionDto> {
    const operation = `addsection/${configId}`;
    return this.invokeServiceCall(payload, `${configId}/sections/add-from-template`, Controllers.DisplayConfigurations, HttpMethod.Post);
  }

  /**
   * Add reusable field to section
   */
  addReusableFieldToSection(
    sectionId: string,
    payload: AddReusableFieldRequestDto
  ): Promise<DisplayFieldDto> {
    const operation = `addfield/${sectionId}`;
    return this.invokeServiceCall(payload, `${sectionId}/fields/add-from-template`, Controllers.DisplaySections, HttpMethod.Post);
  }
}

export const displayConfigClient = DisplayConfigClient.getInstance();

