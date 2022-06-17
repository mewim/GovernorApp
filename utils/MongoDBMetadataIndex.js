use opencanada;
db.metadata.dropIndex("text_search_en");
db.metadata.createIndex(
  {
    "title_translated.en": "text",
    "resources.name_translated.en": "text",
    "notes_translated.en": "text",
    "keywords.en": "text",
    subject: "text",
    "organization.title": "text",
    "organization.description": "text",
    "resources.description": "text",
  },
  { language_override: "dummy", name: "text_search_en" }
);
