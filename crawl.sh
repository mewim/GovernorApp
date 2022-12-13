#!/bin/bash
node utils/MetadataDownloader
node utils/FileDownloader
node utils/MongoDBImporter
rm -r data/json/