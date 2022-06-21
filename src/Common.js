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
  
}

// Singleton instance
const instance = new Common();
export default instance;
