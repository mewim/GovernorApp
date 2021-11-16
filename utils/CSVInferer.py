import pymongo
import os
import sys
import pandas as pd
import math
import tableschema
import charset_normalizer

MISSING_VALUES = ["", "nan", "null", "n/a", "n/d", "-", "...", "(n/a)"]
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(
    os.path.abspath(__file__)), "..", "data/files/"))


def is_missing_value(val):
    try:
        return str(val).lower() in MISSING_VALUES
    except:
        return False


def isna(val):
    try:
        return math.isnan(val)
    except:
        return False


def get_file_encoding(csv_path):
    with open(csv_path, 'rb') as f:
        data = f.read(100000)
    return charset_normalizer.detect(data).get("encoding")


'''
Implment the heuristic, get the top 500 to get number of cols. 
Take the first row without NA value as header.
'''


def get_header_row(csv_path, encoding, nrows=500):
    df = pd.read_csv(csv_path, nrows=nrows, header=None,
                     skip_blank_lines=False, encoding=encoding)
    for i, row in df.iterrows():
        is_valid_row = True
        for val in row:
            if isna(val) or is_missing_value(val):
                is_valid_row = False
                break
        if is_valid_row:
            return i


def update_database(uuid, header, schema, encoding):
    mongo_client = pymongo.MongoClient('mongodb://127.0.0.1:27017/')
    db = mongo_client['opencanada']
    inferred_collection = db.inferredstats
    inferred_collection.find_one_and_replace(
        {"uuid": uuid}, {"uuid": uuid, "header": header, "schema": schema, "encoding": encoding}, upsert=True)
    mongo_client.close()


def main(uuid):
    file_path = os.path.join(BASE_DIR, uuid + ".csv")
    encoding = get_file_encoding(file_path)
    header_idx = get_header_row(file_path, encoding)
    if header_idx is None:
        sys.exit(1)
    schema = tableschema.infer(
        file_path, limit=500, headers=header_idx + 1, confidence=.85)
    update_database(uuid, header_idx, schema, encoding)


if __name__ == "__main__":
    uuid = sys.argv[1]
    main(uuid)
