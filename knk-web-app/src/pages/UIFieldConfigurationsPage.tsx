import React, { useEffect, useState } from "react";
import { UIFieldConfigurationsClient } from "../io/UIFieldConfigurationsClient";
import { UIFieldConfigurationDTO } from "../utils/domain/dto/UIFieldConfigurationDTO";

export function UIFieldConfigurationsPage() {
    const [configurations, setConfigurations] = useState<UIFieldConfigurationDTO[]>([]);
    const [editingConfig, setEditingConfig] = useState<UIFieldConfigurationDTO | null>(null);

    const client = UIFieldConfigurationsClient.getInstance();

    useEffect(() => {
        client.getAll().then(setConfigurations);
    }, []);

    const handleSave = async () => {
        if (editingConfig) {
            if (editingConfig.id === 0) {
                const newConfig = await client.create(editingConfig);
                setConfigurations([...configurations, newConfig]);
            } else {
                const updatedConfig = await client.update(editingConfig);
                setConfigurations(configurations.map(c => c.id === updatedConfig.id ? updatedConfig : c));
            }
            setEditingConfig(null);
        }
    };

    const handleDelete = async (id: number) => {
        await client.delete(id);
        setConfigurations(configurations.filter(c => c.id !== id));
    };

    return (
        <div>
            <h1>UI Field Configurations</h1>
            <button onClick={() => setEditingConfig(new UIFieldConfigurationDTO({}))}>Add New</button>
            {editingConfig && (
                <div>
                    <h2>{editingConfig.id === 0 ? "Add New" : "Edit"} Configuration</h2>
                    <input
                        type="text"
                        placeholder="Object Type"
                        value={editingConfig.objectType}
                        onChange={e => setEditingConfig(editingConfig ? new UIFieldConfigurationDTO({ ...editingConfig, objectType: e.target.value }) : null)}
                    />
                    <input
                        type="text"
                        placeholder="Field Name"
                        value={editingConfig.fieldName}
                        onChange={e => setEditingConfig(editingConfig ? new UIFieldConfigurationDTO({ ...editingConfig, fieldName: e.target.value }) : null)}
                    />
                    {/* Add other fields similarly */}
                    <button onClick={handleSave}>Save</button>
                    <button onClick={() => setEditingConfig(null)}>Cancel</button>
                </div>
            )}
            <ul>
                {configurations.map(config => (
                    <li key={config.id}>
                        {config.label} ({config.fieldName})
                        <button onClick={() => setEditingConfig(config)}>Edit</button>
                        <button onClick={() => handleDelete(config.id)}>Delete</button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
