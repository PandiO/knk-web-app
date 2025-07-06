import React from "react";
import { UIObjectConfigDto } from "../utils/domain/dto/uiObjectConfig/UIFieldConfigurations";
import FieldGroup from "./FieldGroup";
import FieldComponent from "./FieldComponent";

function DynamicFormRenderer({ config }: { config: UIObjectConfigDto }) {
  return (
    <form>
      {config.fieldGroups?.map((group) => (
        <FieldGroup key={group.name} group={group} />
      ))}
      {config.fields?.map((field) => (
        <FieldComponent key={field.name} field={field} />
      ))}
    </form>
  );
}

export default DynamicFormRenderer;
