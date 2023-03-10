import pymongo
import os
import sys
import pandas as pd
import numpy as np
import math
import json

FILE_SIZE_LIMIT = 2e9
MISSING_VALUES = set([
    "",
    "nan",
    "null",
    "n/a",
    "n/d",
    "-",
    "...",
    "(n/a)",
])
BINS = 20
CONFIG_PATH = os.path.abspath(os.path.join(os.path.dirname(
    os.path.abspath(__file__)), "..", "app.config.json"))

with open(CONFIG_PATH) as f:
    config = json.load(f)

file_path = sys.argv[1]
uuid = os.path.splitext(os.path.basename(file_path))[0]

print("Processing histogram for", uuid, "...")

if not os.path.isfile(file_path):
    print(uuid, "cannot be opened, quitting...")


file_size = os.path.getsize(file_path)
if file_size > FILE_SIZE_LIMIT:
    print(uuid, "is too large, quitting...")
    sys.exit(0)


mongo_client = pymongo.MongoClient(config["mongodb"]["uri"])
db = mongo_client[config["mongodb"]["db"]]
metadata_collection = db.metadata
inferredstats_collection = db.inferredstats
inferredhistograms_collection = db.inferredhistograms
inferredcolumnstats_collection = db.inferredcolumnstats


inferred_stat = inferredstats_collection.find_one({"uuid": uuid})
if inferred_stat is None:
    print("Schema of", uuid, "is not found in MongoDB, quitting...")
    mongo_client.close()
    sys.exit(0)

inferred_hist = inferredhistograms_collection.find_one({"uuid": uuid})
if inferred_hist is not None:
    print(uuid, "has already been processed, quitting...")
    mongo_client.close()
    sys.exit(0)

encoding = inferred_stat["encoding"]
header_idx = inferred_stat["header"]
schema = inferred_stat["schema"]


df = pd.read_csv(file_path, header=header_idx,
                 encoding=encoding, low_memory=False)
df.dropna(how='all', axis=1, inplace=True)
df.dropna(how='all', axis=0, inplace=True)


histograms = {}
for f in schema["fields"]:
    hist_object = None
    try:
        col = list(df[f["name"]])
        col_type = f['type']
        if col_type in ["integer", "number"]:
            parsed_col = []
            na_count = 0
            for v in col:
                try:
                    parsed_v = float(v)
                except:
                    parsed_v = None
                if parsed_v is None:
                    na_count += 1
                else:
                    parsed_col.append(parsed_v)
            try:
                mean = np.mean(parsed_col)
            except:
                mean = math.nan
            try:
                stdev = np.std(parsed_col)
            except:
                stdev = math.nan
            try:
                median = np.median(parsed_col)
            except:
                median = math.nan
            try:
                hist = np.histogram(parsed_col, bins=BINS)
            except:
                hist = None
            hist_object = {
                "null_count": na_count,
                "hist": hist[0].tolist(),
                "bin_edges":  hist[1].tolist(),
                "mean": mean,
                "median": median,
                "stdev": stdev
            }
        else:
            hist_dict = {}
            na_count = 0
            for v in col:
                if str(v).lower() in MISSING_VALUES:
                    na_count += 1
                else:
                    if v not in hist_dict:
                        hist_dict[v] = 0
                    hist_dict[v] += 1
            hist_dict = dict(
                sorted(hist_dict.items(), key=lambda item: item[1], reverse=True))
            hist_object = {
                "null_count": na_count,
                "unique_values": len(hist_dict),
                "hist": list(hist_dict.values())[:BINS],
                "bins": list(hist_dict.keys())[:BINS]
            }
        histograms[f["name"]] = hist_object
    except Exception as e:
        continue


inferredhistograms_collection.find_one_and_delete({"uuid": uuid})
inferredhistograms_collection.insert_one(
    {"uuid": uuid, "histograms": histograms})

try:
    results = []
    for i, col_name in enumerate(df.columns):
        c = df[col_name]
        count = len(c)
        unique_values = set(c.unique())
        unique_values_count = len(unique_values)
        is_key = count == unique_values_count
        uniqueness_score = (unique_values_count / count) if count != 0 else 0

        not_is_null = ~(c.astype(str).str.lower().isin(MISSING_VALUES))
        null_values_count = sum(~not_is_null)
        null_percentage = null_values_count / count
        unique_values_without_null = list(c[not_is_null].unique())
        is_all_null = null_values_count == count
        results.append({
            'uuid': uuid,
            'index': i,
            'count': count,
            'unique_values_count': unique_values_count,
            'null_values_count': null_values_count,
            'uniqueness_score': uniqueness_score,
            'is_key': is_key,
            'is_all_null': is_all_null,
            'null_percentage': null_percentage
        })
    inferredcolumnstats_collection.insert_many(results)

except Exception as e:
    pass

print(uuid, "is processed")
mongo_client.close()
