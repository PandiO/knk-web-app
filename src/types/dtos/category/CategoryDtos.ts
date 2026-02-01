import { MinecraftMaterialRefDto } from "../minecraftMaterialRef/MinecraftMaterialRefDto";

export interface CategoryDto {
    id?: string;
    name: string;
    iconMaterialRefId?: number;
    iconMaterialRef?: MinecraftMaterialRefDto;
    iconNamespaceKey?: string;
    parentCategoryId?: string;
    parentCategory?: CategoryDto;
}