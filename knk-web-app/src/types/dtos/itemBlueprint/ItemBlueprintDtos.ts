import { MinecraftMaterialRefDto } from "../minecraftMaterialRef/MinecraftMaterialRefDto";

export interface ItemBlueprintDto {
    id?: number;
    name: string;
    description: string;
    iconMaterialRefId?: number;
    iconMaterialRef?: MinecraftMaterialRefDto;
    iconNamespaceKey?: string;
    defaultDisplayName: string;
    defaultDisplayDescription: string;
}

export interface ItemBlueprintListDto {
    id?: number;
    name: string;
    description: string;
    defaultDisplayName: string;
    iconMaterialRefId?: number;
    iconMaterialRefName?: string;
    iconNamespaceKey?: string;
}
