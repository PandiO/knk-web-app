import React from "react";
import { UIFieldGroupDto } from "../utils/domain/dto/uiObjectConfig/UIFieldConfigurations";
import FieldComponent from "./FieldComponent";

function FieldGroup({ group }: { group: UIFieldGroupDto }) {
  return (
    <fieldset>
      <legend>{group.label}</legend>
      {group.fields.map((field) => (
        <FieldComponent key={field.name} field={field} />
      ))}
    </fieldset>
  );
}

export default FieldGroup;
