# Normalize CSV encoding to UTF-8 and remove rows before the detected first row

import pymongo
import os
import sys
import csv

OUTPUT_DIR = os.path.abspath(os.path.join(os.path.dirname(
    os.path.abspath(__file__)), "..", "data/converted_files/"))
MONGO_URI = 'mongodb://127.0.0.1:27017/'

file_path = sys.argv[1]
uuid = os.path.splitext(os.path.basename(file_path))[0]
output_path = os.path.join(OUTPUT_DIR, "%s.csv" % (uuid))


print("processing", "%s..." % (uuid))

mongo_client = pymongo.MongoClient(MONGO_URI)
db = mongo_client['opencanada']
inferredstats_collection = db.inferredstats

inferred_stat = inferredstats_collection.find_one({"uuid": uuid})
mongo_client.close()
if inferred_stat is None:
    print("schema of", uuid, "is not found in MongoDB, quitting...")
    sys.exit(0)

if os.path.exists(output_path):
    print(uuid, "has been processed, quitting...")
    sys.exit(0)


encoding = inferred_stat["encoding"]
header_idx = inferred_stat["header"]

with open(file_path, encoding=encoding, mode="r") as input_file:
    with open(output_path, mode="w", encoding="utf-8") as output_file:
        csv_reader = csv.reader(input_file)
        csv_writer = csv.writer(output_file)
        for idx, row in enumerate(csv_reader):
            if idx < header_idx:
                continue
            csv_writer.writerow(row)

print("finished processing", uuid)
