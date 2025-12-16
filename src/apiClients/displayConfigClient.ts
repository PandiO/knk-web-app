// DisplayConfiguration API Client
// Provides API calls to backend DisplayConfiguration endpoints

import { appConfig } from '../config/appConfig';
import {
  DisplayConfigurationDto,
  DisplaySectionDto,
  DisplayFieldDto,
  ReuseLinkMode,
  AddReusableSectionRequestDto,
  AddReusableFieldRequestDto
} from '../types/dtos/displayConfig/DisplayModels';

const API_BASE_URL = appConfig.api.baseUrl;

export const displayConfigClient = {
  // ===== DISPLAYCONFIGURATIONS ENDPOINTS =====
  
  /**
   * Get all display configurations
   */
  async getAll(includeDrafts: boolean = true): Promise<DisplayConfigurationDto[]> {
    const response = await fetch(
      `${API_BASE_URL}/displayconfigurations?includeDrafts=${includeDrafts}`
    );
    if (!response.ok) throw new Error('Failed to fetch configurations');
    return response.json();
  },

  /**
   * Get display configuration by ID
   */
  async getById(id: number): Promise<DisplayConfigurationDto> {
    const response = await fetch(`${API_BASE_URL}/displayconfigurations/${id}`);
    if (!response.ok) throw new Error('Configuration not found');
    return response.json();
  },

  /**
   * Get default display configuration for entity type
   */
  async getDefaultByEntityType(
    entityName: string,
    includeDrafts: boolean = false
  ): Promise<DisplayConfigurationDto> {
    const response = await fetch(
      `${API_BASE_URL}/displayconfigurations/entity/${entityName}?includeDrafts=${includeDrafts}`
    );
    if (!response.ok) throw new Error('No default configuration found');
    return response.json();
  },

  /**
   * Create new display configuration
   */
  async create(config: DisplayConfigurationDto): Promise<DisplayConfigurationDto> {
    const response = await fetch(`${API_BASE_URL}/displayconfigurations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (!response.ok) throw new Error('Failed to create configuration');
    return response.json();
  },

  /**
   * Update existing display configuration
   */
  async update(id: number, config: DisplayConfigurationDto): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/displayconfigurations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (!response.ok) throw new Error('Failed to update configuration');
  },

  /**
   * Delete display configuration
   */
  async delete(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/displayconfigurations/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete configuration');
  },

  /**
   * Publish draft configuration
   */
  async publish(id: number): Promise<DisplayConfigurationDto> {
    const response = await fetch(
      `${API_BASE_URL}/displayconfigurations/${id}/publish`,
      { method: 'POST' }
    );
    if (!response.ok) throw new Error('Failed to publish configuration');
    return response.json();
  },

  /**
   * Clone/copy configuration
   */
  async clone(id: number, linkMode: ReuseLinkMode): Promise<DisplayConfigurationDto> {
    const response = await fetch(
      `${API_BASE_URL}/displayconfigurations/${id}/clone`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkMode })
      }
    );
    if (!response.ok) throw new Error('Failed to clone configuration');
    return response.json();
  },

  // ===== DISPLAYSECTIONS ENDPOINTS =====

  /**
   * Get all reusable sections
   */
  async getAllReusableSections(): Promise<DisplaySectionDto[]> {
    const response = await fetch(`${API_BASE_URL}/displaysections/reusable`);
    if (!response.ok) throw new Error('Failed to fetch reusable sections');
    return response.json();
  },

  /**
   * Get section by ID
   */
  async getSectionById(id: number): Promise<DisplaySectionDto> {
    const response = await fetch(`${API_BASE_URL}/displaysections/${id}`);
    if (!response.ok) throw new Error('Section not found');
    return response.json();
  },

  /**
   * Create standalone reusable section
   */
  async createReusableSection(section: DisplaySectionDto): Promise<DisplaySectionDto> {
    const response = await fetch(`${API_BASE_URL}/displaysections/reusable`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(section)
    });
    if (!response.ok) throw new Error('Failed to create reusable section');
    return response.json();
  },

  /**
   * Update section
   */
  async updateSection(id: number, section: DisplaySectionDto): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/displaysections/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(section)
    });
    if (!response.ok) throw new Error('Failed to update section');
  },

  /**
   * Delete section
   */
  async deleteSection(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/displaysections/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete section');
  },

  /**
   * Clone/copy section
   */
  async cloneSection(id: number, linkMode: ReuseLinkMode): Promise<DisplaySectionDto> {
    const response = await fetch(`${API_BASE_URL}/displaysections/${id}/clone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ linkMode })
    });
    if (!response.ok) throw new Error('Failed to clone section');
    return response.json();
  },

  // ===== DISPLAYFIELDS ENDPOINTS =====

  /**
   * Get all reusable fields
   */
  async getAllReusableFields(): Promise<DisplayFieldDto[]> {
    const response = await fetch(`${API_BASE_URL}/displayfields/reusable`);
    if (!response.ok) throw new Error('Failed to fetch reusable fields');
    return response.json();
  },

  /**
   * Get field by ID
   */
  async getFieldById(id: number): Promise<DisplayFieldDto> {
    const response = await fetch(`${API_BASE_URL}/displayfields/${id}`);
    if (!response.ok) throw new Error('Field not found');
    return response.json();
  },

  /**
   * Create standalone reusable field
   */
  async createReusableField(field: DisplayFieldDto): Promise<DisplayFieldDto> {
    const response = await fetch(`${API_BASE_URL}/displayfields/reusable`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(field)
    });
    if (!response.ok) throw new Error('Failed to create reusable field');
    return response.json();
  },

  /**
   * Update field
   */
  async updateField(id: number, field: DisplayFieldDto): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/displayfields/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(field)
    });
    if (!response.ok) throw new Error('Failed to update field');
  },

  /**
   * Delete field
   */
  async deleteField(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/displayfields/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) throw new Error('Failed to delete field');
  },

  /**
   * Clone/copy field
   */
  async cloneField(id: number, linkMode: ReuseLinkMode): Promise<DisplayFieldDto> {
    const response = await fetch(`${API_BASE_URL}/displayfields/${id}/clone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ linkMode })
    });
    if (!response.ok) throw new Error('Failed to clone field');
    return response.json();
  },

  // ===== TEMPLATE OPERATIONS (for builder) =====

  /**
   * Add reusable section to configuration
   */
  async addReusableSectionToConfiguration(
    configId: string,
    payload: AddReusableSectionRequestDto
  ): Promise<DisplaySectionDto> {
    const response = await fetch(
      `${API_BASE_URL}/displayconfigurations/${configId}/sections/add-from-template`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    );
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to add reusable section');
    }
    return response.json();
  },

  /**
   * Add reusable field to section
   */
  async addReusableFieldToSection(
    sectionId: string,
    payload: AddReusableFieldRequestDto
  ): Promise<DisplayFieldDto> {
    const response = await fetch(
      `${API_BASE_URL}/displaysections/${sectionId}/fields/add-from-template`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    );
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to add reusable field');
    }
    return response.json();
  }
};

