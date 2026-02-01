import { logging, Controllers, HttpMethod } from "../utils";
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
  getAll(includeDrafts: boolean = true): Promise<DisplayConfigurationDto[]> {
    const operation = includeDrafts ? 'getall' : 'getall-published';
    return this.invokeServiceCall(null, operation, Controllers.DisplayConfigurations, HttpMethod.Get);
  }

  /**
   * Get display configuration by ID
   */
  getById(id: number): Promise<DisplayConfigurationDto> {
    return this.invokeServiceCall(null, `getbyid/${id}`, Controllers.DisplayConfigurations, HttpMethod.Get);
  }

  /**
   * Get default display configuration for entity type
   */
  getDefaultByEntityType(
    entityName: string,
    includeDrafts: boolean = false
  ): Promise<DisplayConfigurationDto> {
    const operation = `entity/${entityName}`;
    return this.invokeServiceCall({ includeDrafts }, operation, Controllers.DisplayConfigurations, HttpMethod.Get);
  }

  /**
   * Get all display configurations for entity type
   */
  getAllByEntityType(
    entityName: string,
    includeDrafts: boolean = true
  ): Promise<DisplayConfigurationDto[]> {
    const operation = `entity/${entityName}/all`;
    return this.invokeServiceCall({ includeDrafts }, operation, Controllers.DisplayConfigurations, HttpMethod.Get);
  }

  /**
   * Get list of all entity type names with display configurations
   */
  getEntityTypeNames(): Promise<string[]> {
    return this.invokeServiceCall(null, 'entity-names', Controllers.DisplayConfigurations, HttpMethod.Get);
  }

  /**
   * Create new display configuration (starts as draft)
   */
  create(config: DisplayConfigurationDto): Promise<DisplayConfigurationDto> {
    return this.invokeServiceCall(config, '', Controllers.DisplayConfigurations, HttpMethod.Post);
  }

  /**
   * Update existing display configuration
   */
  update(id: number, config: DisplayConfigurationDto): Promise<void> {
    return this.invokeServiceCall(config, `update/${id}`, Controllers.DisplayConfigurations, HttpMethod.Put);
  }

  /**
   * Delete display configuration
   */
  delete(id: number): Promise<void> {
    return this.invokeServiceCall(null, `delete/${id}`, Controllers.DisplayConfigurations, HttpMethod.Delete);
  }

  /**
   * Publish display configuration (sets IsDraft = false after validation)
   */
  publish(id: number): Promise<DisplayConfigurationDto> {
    return this.invokeServiceCall(null, `publish/${id}`, Controllers.DisplayConfigurations, HttpMethod.Post);
  }

  /**
   * Clone/copy configuration
   */
  clone(id: number, linkMode: ReuseLinkMode): Promise<DisplayConfigurationDto> {
    return this.invokeServiceCall({ linkMode }, `clone/${id}`, Controllers.DisplayConfigurations, HttpMethod.Post);
  }

  // ===== DISPLAYSECTIONS ENDPOINTS =====

  /**
   * Get all reusable sections
   */
  getAllReusableSections(): Promise<DisplaySectionDto[]> {
    return this.invokeServiceCall(null, 'reusable', Controllers.DisplaySections, HttpMethod.Get);
  }

  /**
   * Get section by ID
   */
  getSectionById(id: number): Promise<DisplaySectionDto> {
    return this.invokeServiceCall(null, `getbyid/${id}`, Controllers.DisplaySections, HttpMethod.Get);
  }

  /**
   * Create standalone reusable section
   */
  createReusableSection(section: DisplaySectionDto): Promise<DisplaySectionDto> {
    return this.invokeServiceCall(section, 'reusable', Controllers.DisplaySections, HttpMethod.Post);
  }

  /**
   * Update section
   */
  updateSection(id: number, section: DisplaySectionDto): Promise<void> {
    return this.invokeServiceCall(section, `update/${id}`, Controllers.DisplaySections, HttpMethod.Put);
  }

  /**
   * Delete section
   */
  deleteSection(id: number): Promise<void> {
    return this.invokeServiceCall(null, `delete/${id}`, Controllers.DisplaySections, HttpMethod.Delete);
  }

  /**
   * Clone/copy section
   */
  cloneSection(id: number, linkMode: ReuseLinkMode): Promise<DisplaySectionDto> {
    return this.invokeServiceCall({ linkMode }, `clone/${id}`, Controllers.DisplaySections, HttpMethod.Post);
  }

  // ===== DISPLAYFIELDS ENDPOINTS =====

  /**
   * Get all reusable fields
   */
  getAllReusableFields(): Promise<DisplayFieldDto[]> {
    return this.invokeServiceCall(null, 'reusable', Controllers.DisplayFields, HttpMethod.Get);
  }

  /**
   * Get field by ID
   */
  getFieldById(id: number): Promise<DisplayFieldDto> {
    return this.invokeServiceCall(null, `getbyid/${id}`, Controllers.DisplayFields, HttpMethod.Get);
  }

  /**
   * Create standalone reusable field
   */
  createReusableField(field: DisplayFieldDto): Promise<DisplayFieldDto> {
    return this.invokeServiceCall(field, 'reusable', Controllers.DisplayFields, HttpMethod.Post);
  }

  /**
   * Update field
   */
  updateField(id: number, field: DisplayFieldDto): Promise<void> {
    return this.invokeServiceCall(field, `update/${id}`, Controllers.DisplayFields, HttpMethod.Put);
  }

  /**
   * Delete field
   */
  deleteField(id: number): Promise<void> {
    return this.invokeServiceCall(null, `delete/${id}`, Controllers.DisplayFields, HttpMethod.Delete);
  }

  /**
   * Clone/copy field
   */
  cloneField(id: number, linkMode: ReuseLinkMode): Promise<DisplayFieldDto> {
    return this.invokeServiceCall({ linkMode }, `clone/${id}`, Controllers.DisplayFields, HttpMethod.Post);
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
    return this.invokeServiceCall(payload, operation, Controllers.DisplayConfigurations, HttpMethod.Post);
  }

  /**
   * Add reusable field to section
   */
  addReusableFieldToSection(
    sectionId: string,
    payload: AddReusableFieldRequestDto
  ): Promise<DisplayFieldDto> {
    const operation = `addfield/${sectionId}`;
    return this.invokeServiceCall(payload, operation, Controllers.DisplaySections, HttpMethod.Post);
  }
}

export const displayConfigClient = DisplayConfigClient.getInstance();

