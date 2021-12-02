import pymongo
import os
import sys
import pandas as pd
import numpy as np
import math


MONGO_URI = 'mongodb://127.0.0.1:27017/'
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


file_path = sys.argv[1]
uuid = os.path.splitext(os.path.basename(file_path))[0]

print("processing", uuid, "...")

if not os.path.isfile(file_path):
    print(uuid, "cannot be opened, quitting...")


file_size = os.path.getsize(file_path)
if file_size > FILE_SIZE_LIMIT:
    print(uuid, "is too large, quitting...")
    sys.exit(0)


mongo_client = pymongo.MongoClient(MONGO_URI)
db = mongo_client['opencanada']
metadata_collection = db.metadata
inferredstats_collection = db.inferredstats
inferredhistograms_collection = db.inferredhistograms


inferred_stat = inferredstats_collection.find_one({"uuid": uuid})
if inferred_stat is None:
    print("schema of", uuid, "is not found in MongoDB, quitting...")
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

print(uuid, "is processed")
mongo_client.close()
