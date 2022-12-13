import { portal } from "../app.config.json";
import moment from "moment";
class Common {
  constructor() {}

  getColumnDescription(dataDictionary, name, delimiter = "<br/>") {
    const NO_DESCRIPTION = "(No description available)";
    if (!dataDictionary || !dataDictionary.fields) {
      return NO_DESCRIPTION;
    }
    const field = dataDictionary.fields.find((f) => f.field_name === name);
    if (!field) {
      return NO_DESCRIPTION;
    }
    const descriptionText = [];
    if (field.field_desc) {
      descriptionText.push(field.field_desc);
    }
    if (field.values && field.values.length > 0) {
      if (descriptionText.length > 0) {
        descriptionText.push("");
      }
      descriptionText.push("Possible values:");
      field.values.forEach((v) => {
        descriptionText.push(`- ${v.value_name}: ${v.value_desc}`);
      });
    }
    return descriptionText.join(delimiter);
  }
  getDatasetUrl(uuid) {
    return portal.siteUrl + uuid;
  }
  escapeHtml(unsafe) {
    return unsafe
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  getField(object, field) {
    if (field.includes(".")) {
      const fields = field.split(".");
      let value = object;
      fields.forEach((f) => {
        value = value[f];
      });
      return value;
    } else {
      return object[field];
    }
  }
  formatDate(date) {
    return moment(date).format("MMM Do YYYY");
  }
}

// Singleton instance
const instance = new Common();
export default instance;
