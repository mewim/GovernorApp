<div align="center">
  <img src="/figures/teaser.png">
</div>

# Governor App
Governor is an open-sourced web application developed to make open governmental data portals (OGDPs) more accessible to end users by facilitating searching actual records in the tables, previewing them directly without downloading, and suggesting joinable and unionable tables to users based on their latest working tables. Governor also manages the provenance of integrated tables allowing users and their collaborators to easily trace back to the original tables in OGDP.

## Dependencies
- [MongoDB 5.0](https://www.mongodb.com/docs/v5.0/)
- [Elasticsearch 7.17](https://www.elastic.co/guide/en/elasticsearch/reference/7.17/index.html)
- [Node.js v14](https://nodejs.org/docs/latest-v14.x/api/)
- [Python 3.9](https://docs.python.org/3.9/index.html)

## Getting Started
- Install all dependencies mentioned above. Note that the default configuration file assumes that MongoDB and Elasticsearch are installed on the same machine and not secured. If the configuration is different, please modify `app.config.json` accordingly.
- Project setup:
```
npm install
npm run install-python
```
- Crawl data from the OGDP:
```
bash crawl.sh
```
- Pre-process the data and create the required indices:
```
bash preprocess.sh
```
### Run server for development (with hot reload)
```
npm run serve
```

### Run server for production (with compiled and minified JavaScript files)
```
npm run serve-deployed
```

### Lint and fix files
```
npm run lint
```

## Configuring Governor
Governor can be configured with a single JSON configuration (`app.config.json`) where a system administrator can specify the metadata fields that should be indexed for search and displayed on the front end, as well as the URL of the CKAN endpoint for crawling. The `app.config.json` file provided in this repository is an example for deployment with [Data.gov.sg](https://data.gov.sg/). By simply modifying the configuration file, Governor can be easily deployed with other open data portals. Below we provide a description of each field of the configuration file:

- `portal`:
  - `siteName`: The name of the open data portal. For example, Open Canada.
  - `siteUrl`:  URL prefix of the metadata page of the datasets. Will be concatenated with dataset UUIDs to generate links to the original dataset. For example, [https://open.canada.ca/data/en/dataset/](https://open.canada.ca/data/en/dataset/). 
  - `packageApiUrl`: The CKAN API endpoint for harvesting the metadata information. For example, [https://open.canada.ca/data/api/action/package_search](https://open.canada.ca/data/api/action/package_search).
  - `fileDownloaderConcurrency`: The max number of concurrent threads for crawling the files. Should be set according to the bandwidth and rate limit of the portal.
- `mongodb`:
  - `uri`: The URI of the MongoDB server starting with `mongodb://`.
  - `db`: The database name of the MongoDB.
  - `metadataIndexFields`: Fields in the metadata that should be indexed for search. Nested fields are supported in the format of `fieldA.subFieldB`.
- `elasticsearch`:
  - `uri`: The URI of the Elasticsearch REST API server starting with `http://` or `https://`.
  - `index`: The index name of the Elasticsearch.
  - `token`: The bearer token of Elasticsearch REST API server for authentication. Can be left empty if the server is not secured.
- `frontend`:
  - `search`:
    - `fields`: An array of all the field to be displayed on the search result page for the dataset (top level entry).
      - `fieldName`: The name/path of the field. Nested fields are supported in the format of `fieldA.subFieldB`.
      - `displayName`: Human-readable name of the field.
      - `type`: The type of the field. Currently 3 different formats are supported: 1) text, which will be directly rendered; 2) date, which will be formatted as `Month Day Year`; 3) list, which will be formatted as multiple labels.
    - `resourcesFields`: An array of all the field to be displayed on the search result page for the resources (tables under a dataset). The definition of each field is the same as that of `frontend.search.fields`.
  - `preview`: 
    - `fields`: An array of all the field to be displayed on the table preview page for the dataset (under "Dataset Details"). The definition of each field is the same as that of `frontend.search.fields`.

## Citing Governor
If you are a researcher and use Governor in your work, we encourage you to cite our work. You can use the following BibTeX citation:

```
@inproceedings{governor:chi,
  author =  {Chang Liu and
             Arif Usta and
             Jian Zhao and
             Semih Saliho\u{g}lu},
  title={Governor: Turning Open Government Data Portals into Interactive Databases},
  booktitle={Proceedings of the 2023 CHI Conference on Human Factors in Computing Systems (CHI '23)},
  year={2023}
}
```

