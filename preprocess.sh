#!/bin/bash

NUMBER_OF_PROCESSORS=$(nproc --all)
BASE_DIR=$(pwd)
FILES_DIR=$BASE_DIR/data/files

echo "Number of processors: $NUMBER_OF_PROCESSORS"
echo "Files directory: $FILES_DIR"

echo "Creating Elasticsearch index..."
node utils/ElasticSearchIndexCreater

echo "Indexing CSV files..."
cd $FILES_DIR && find . -name "*.csv" -print0 | xargs -r -0 -n 1 -P $NUMBER_OF_PROCESSORS -- sh -c 'timeout 2400 node ../../utils/ElasticSearchCSVIndexer.js "$@"; true' --

echo "Computing histograms..."
cd $FILES_DIR && find . -name "*.csv" -print0 | xargs -r -0 -n 1 -P $NUMBER_OF_PROCESSORS -- sh -c 'timeout 2400 python3 ../../utils/HistogramGenerator.py "$@"; true' --

echo "Computing key column overlap..."
python3 utils/KeyColumnOverlap.py

echo "Finding unionable tables..."
python3 utils/UnionableTableFinder.py

echo "Creating MongoDB index..."
node utils/MongoDBIndexCreator
