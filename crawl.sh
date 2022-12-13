#!/bin/bash
mkdir -p data/parquet_cache
node utils/MetadataDownloader
node utils/FileDownloader
node utils/MongoDBImporter
rm -r data/json/