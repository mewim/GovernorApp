import pymongo
from tqdm import tqdm
import os
import json
import itertools

CONFIG_PATH = os.path.abspath(os.path.join(os.path.dirname(
    os.path.abspath(__file__)), "..", "app.config.json"))

with open(CONFIG_PATH) as f:
    config = json.load(f)
mongo_client = pymongo.MongoClient(config["mongodb"]["uri"])
db = mongo_client[config["mongodb"]["db"]]
inferredstats_collection = db["inferredstats"]

print("Finding candidate unionable tables...")
inferredstats_fields = {}
for i in inferredstats_collection.find({}):
    fields = []
    for f in i['schema']['fields']:
        fields.append(f['name'])
    inferredstats_fields[i['uuid']] = sorted(fields)
combs = list(itertools.combinations(sorted(list(inferredstats_fields.keys())), 2))
results = []
for t1, t2 in tqdm(combs):
    fields_t1 = inferredstats_fields[t1]
    fields_t2 = inferredstats_fields[t2]
    is_same_schema = fields_t1 == fields_t2
    if is_same_schema:
        results.append({
            'table_1': t1,
            'table_2': t2,
            'is_same_schema': is_same_schema
        })

schemas_hash = {}

for (k, v) in inferredstats_fields.items():
    hash_key = json.dumps(v)
    if hash_key not in schemas_hash:
        schemas_hash[hash_key] = []
    schemas_hash[hash_key].append(k)

groups = list(schemas_hash.values())
groups_more_than_one = [{"uuids": g} for g in groups if len(g) > 1]

print("Found", len(groups_more_than_one), " unionable table groups")
print("Saving to MongoDB...")
db["sameschemagroups"].drop()
db["sameschemagroups"].insert_many(groups_more_than_one)
print("Done")
mongo_client.close()