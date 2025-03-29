import React, { useEffect, useState } from 'react';
import { Settings2, AlertCircle, Loader2, Plus, Pencil, Trash2, LayoutGrid, ListPlus } from 'lucide-react';
import { UIObjectConfigDto, UIFieldType, ValidationType, UIFieldGroupDto, UIFieldDto } from '../utils/domain/dto/UIFieldConfigurations';
import { uiFieldConfigurationsManager } from '../io/UIFieldConfigurationsClient';
import { getConfig } from '../config/appConfig'; // Ensure this file exists at the specified path
import { uiConfigTestData } from '../data/testData';

interface UIFieldConfigurationsPageProps {
  objectType: string;
}

const createEmptyConfig = (): UIObjectConfigDto => ({
  objectType: '',
  title: '',
  layoutStyle: 'standard',
  fields: [],
  fieldGroups: []
});

const createEmptyField = (): UIFieldDto => ({
  name: '',
  label: '',
  type: UIFieldType.Text,
  required: false,
  order: 0
});

const createEmptyFieldGroup = (): UIFieldGroupDto => ({
  name: '',
  label: '',
  order: 0,
  fields: []
});

function UIFieldConfigurationsPage({ objectType }: UIFieldConfigurationsPageProps) {
  const [configs, setConfigs] = useState<UIObjectConfigDto[]>([]);
  const [editingConfig, setEditingConfig] = useState<UIObjectConfigDto | null>(null);
  const [editingField, setEditingField] = useState<UIFieldDto | null>(null);
  const [editingFieldGroup, setEditingFieldGroup] = useState<UIFieldGroupDto | null>(null);
  const [selectedGroupIndex, setSelectedGroupIndex] = useState<number>(-1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchConfig() {
      try {
        setLoading(true);
        setError(null);

        let data: UIObjectConfigDto[] = [];

        if (getConfig('useTestData')) {
          data = uiConfigTestData;
          // Simulate network delay
          await new Promise(resolve => setTimeout(resolve, 500));
        } else {
          data = await uiFieldConfigurationsManager.getAll();
        }

        setConfigs(data);
      } catch (error) {
        setError('Failed to load configuration');
        console.error('Error fetching UIObjectConfig:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchConfig();
  }, [objectType]);

  const handleSave = async () => {
    if (!editingConfig) return;

    try {
      setLoading(true);
      if (getConfig('useTestData')) {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (editingConfig.objectType === '') {
          setConfigs(prev => [...prev, { ...editingConfig, objectType: `config-${Date.now()}` }]);
        } else {
          setConfigs(prev => prev.map(c => 
            c.objectType === editingConfig.objectType ? editingConfig : c
          ));
        }
      } else {
        if (editingConfig.objectType === '') {
          await uiFieldConfigurationsManager.create(editingConfig);
        } else {
          await uiFieldConfigurationsManager.update(editingConfig);
        }
        // Refresh the list
        const updatedConfigs = await uiFieldConfigurationsManager.getAll();
        setConfigs(updatedConfigs);
      }
      setEditingConfig(null);
    } catch (error) {
      setError('Failed to save configuration');
      console.error('Error saving configuration:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (objectType: string) => {
    try {
      if (!getConfig('useTestData')) {
        await uiFieldConfigurationsManager.delete(parseInt(objectType));
      }
      setConfigs(prev => prev.filter(c => c.objectType !== objectType));
    } catch (error) {
      setError('Failed to delete configuration');
      console.error('Error deleting configuration:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            Loading Configuration...
          </h3>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            Error Loading Configuration
          </h3>
          <p className="mt-2 text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow-sm rounded-lg">
          <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium text-gray-900">
                  UI Field Configurations
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Manage field configurations for different object types
                </p>
              </div>
              <button
                onClick={() => setEditingConfig(createEmptyConfig())}
                className="btn-primary"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add New Configuration
              </button>
            </div>
          </div>
          
          <div className="px-4 py-5 sm:p-6">
            {editingConfig ? (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Configuration Name
                  </label>
                  <input
                    type="text"
                    value={editingConfig.objectType}
                    onChange={e => setEditingConfig({
                      ...editingConfig,
                      objectType: e.target.value
                    })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                    placeholder="Enter configuration name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Display Title
                  </label>
                  <input
                    type="text"
                    value={editingConfig.title}
                    onChange={e => setEditingConfig({
                      ...editingConfig,
                      title: e.target.value
                    })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                    placeholder="Enter configuration title"
                  />
                </div>

                {/* Field Groups Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">Field Groups</h3>
                    <button
                      onClick={() => setEditingFieldGroup(createEmptyFieldGroup())}
                      className="btn-secondary"
                    >
                      <LayoutGrid className="h-4 w-4 mr-2" />
                      Add Group
                    </button>
                  </div>
                  
                  {editingConfig.fieldGroups?.map((group, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{group.label || 'Untitled Group'}</h4>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => {
                              setSelectedGroupIndex(index);
                              setEditingFieldGroup(group);
                            }}
                            className="text-gray-400 hover:text-gray-500"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              const newConfig = { ...editingConfig };
                              newConfig.fieldGroups = newConfig.fieldGroups?.filter((_, i) => i !== index);
                              setEditingConfig(newConfig);
                            }}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      
                      {/* Fields within group */}
                      <div className="space-y-2">
                        {group.fields.map((field, fieldIndex) => (
                          <div key={fieldIndex} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                            <div>
                              <span className="font-medium">{field.label}</span>
                              <span className="ml-2 text-sm text-gray-500">({field.type})</span>
                            </div>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => setEditingField(field)}
                                className="text-gray-400 hover:text-gray-500"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  const newConfig = { ...editingConfig };
                                  newConfig.fieldGroups![index].fields = group.fields.filter((_, i) => i !== fieldIndex);
                                  setEditingConfig(newConfig);
                                }}
                                className="text-gray-400 hover:text-red-500"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            setSelectedGroupIndex(index);
                            setEditingField(createEmptyField());
                          }}
                          className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          <ListPlus className="h-4 w-4 mr-2" />
                          Add Field
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setEditingConfig(null)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="btn-primary"
                  >
                    Save Configuration
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {configs.length === 0 ? (
                  <div className="text-center py-12">
                    <Settings2 className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No configurations</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Get started by creating a new configuration.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {configs.map((config) => (
                      <div
                        key={config.objectType}
                        className="relative bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-lg font-medium text-gray-900">
                              {config.title || 'Untitled Configuration'}
                            </h3>
                            <p className="mt-1 text-sm text-gray-500">
                              Type: {config.objectType}
                            </p>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => setEditingConfig(config)}
                              className="text-gray-400 hover:text-gray-500"
                            >
                              <Pencil className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleDelete(config.objectType)}
                              className="text-gray-400 hover:text-red-500"
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Field Group Editor Modal */}
          {editingFieldGroup && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-lg w-full">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  {selectedGroupIndex === -1 ? 'Add New Group' : 'Edit Group'}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Group Name</label>
                    <input
                      type="text"
                      value={editingFieldGroup.name}
                      onChange={e => setEditingFieldGroup({
                        ...editingFieldGroup,
                        name: e.target.value
                      })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Display Label</label>
                    <input
                      type="text"
                      value={editingFieldGroup.label}
                      onChange={e => setEditingFieldGroup({
                        ...editingFieldGroup,
                        label: e.target.value
                      })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Order</label>
                    <input
                      type="number"
                      value={editingFieldGroup.order}
                      onChange={e => setEditingFieldGroup({
                        ...editingFieldGroup,
                        order: parseInt(e.target.value)
                      })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                    />
                  </div>
                  <div className="flex justify-end space-x-3 mt-6">
                    <button
                      onClick={() => setEditingFieldGroup(null)}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        const newConfig = { ...editingConfig! };
                        if (selectedGroupIndex === -1) {
                          newConfig.fieldGroups = [...(newConfig.fieldGroups || []), editingFieldGroup];
                        } else {
                          newConfig.fieldGroups![selectedGroupIndex] = editingFieldGroup;
                        }
                        setEditingConfig(newConfig);
                        setEditingFieldGroup(null);
                      }}
                      className="btn-primary"
                    >
                      Save Group
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Field Editor Modal */}
          {editingField && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-lg w-full">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  {editingField.name ? 'Edit Field' : 'Add New Field'}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Field Name</label>
                    <input
                      type="text"
                      value={editingField.name}
                      onChange={e => setEditingField({
                        ...editingField,
                        name: e.target.value
                      })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Display Label</label>
                    <input
                      type="text"
                      value={editingField.label}
                      onChange={e => setEditingField({
                        ...editingField,
                        label: e.target.value
                      })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Field Type</label>
                    <select
                      value={editingField.type}
                      onChange={e => setEditingField({
                        ...editingField,
                        type: e.target.value as UIFieldType
                      })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                    >
                      {Object.values(UIFieldType).map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="required"
                      checked={editingField.required}
                      onChange={e => setEditingField({
                        ...editingField,
                        required: e.target.checked
                      })}
                      className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                    />
                    <label htmlFor="required" className="ml-2 block text-sm text-gray-900">
                      Required Field
                    </label>
                  </div>
                  <div className="flex justify-end space-x-3 mt-6">
                    <button
                      onClick={() => setEditingField(null)}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        const newConfig = { ...editingConfig! };
                        const group = newConfig.fieldGroups![selectedGroupIndex];
                        if (!editingField.name) {
                          group.fields.push(editingField);
                        } else {
                          const fieldIndex = group.fields.findIndex(f => f.name === editingField.name);
                          group.fields[fieldIndex] = editingField;
                        }
                        setEditingConfig(newConfig);
                        setEditingField(null);
                      }}
                      className="btn-primary"
                    >
                      Save Field
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
export default UIFieldConfigurationsPage;