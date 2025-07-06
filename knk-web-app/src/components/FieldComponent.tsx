import React from "react";
import { UIFieldDto, UIFieldType } from "../utils/domain/dto/uiObjectConfig/UIFieldConfigurations";

function FieldComponent({ field }: { field: UIFieldDto }) {
  switch (field.type) {
    case UIFieldType.Text:
      return <input type="text" placeholder={field.placeholder} />;
    case UIFieldType.Number:
      return <input type="number" />;
    case UIFieldType.Date:
      return <input type="date" />;
    case UIFieldType.Checkbox:
      return <input type="checkbox" />;
    case UIFieldType.Dropdown:
      return (
        <select>
          {/* Options should be dynamically populated */}
        </select>
      );
    default:
      return null;
  }
}

export default FieldComponent;
