import pymongo
import pandas as pd
from tqdm import tqdm
import os
import json
from multiprocessing import Pool, freeze_support, cpu_count
from functools import partial
import math
from sys import platform

NUM_PROCESSES = int(cpu_count() / 2)
MIN_UNIQUE_VALUE = 2
MIN_UNIQUENESS_SCORE = 0.8
CONFIG_PATH = os.path.abspath(os.path.join(os.path.dirname(
    os.path.abspath(__file__)), "..", "app.config.json"))
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(
    os.path.abspath(__file__)), "..", "data/files/"))


def get_uuid_from_path(p): return os.path.splitext(os.path.basename(p))[0]
def get_path_from_uuid(u): return os.path.join(BASE_DIR, "%s.csv" % u)


def read_file(f, inferredstats_dict=None):
    full_path = f
    uuid = get_uuid_from_path(full_path)
    try:
        sets = []
        if uuid not in inferredstats_dict:
            return
        stats = inferredstats_dict[uuid]
        encoding = stats["encoding"]
        header_idx = stats["header"]
        df = pd.read_csv(full_path, encoding=encoding,
                         header=header_idx, low_memory=False)
        df = df.applymap(lambda s: s.lower().strip() if type(s) == str else s)
        for c in df.columns:
            sets.append(set(df[c].unique()))
        return {"uuid": uuid, "sets": sets}
    except:
        return


def get_stats(pair):
    global column_sets
    try:
        source = pair['source']
        target = pair['target']
        source_set = column_sets[source['uuid']][source['index']]
        target_set = column_sets[target['uuid']][target['index']]
        intersection_size = len(source_set.intersection(target_set))
        if intersection_size == 0:
            return None
        return {
            "union_size": len(source_set.union(target_set)),
            "intersection_size": intersection_size,
            "pair": pair
        }
    except:
        return None


def jaccard(intersection_size, union_size):
    # intersection size divided by union size
    return intersection_size / union_size


def cosine(intersection_size, query_size, target_size):
    # intersection size divided by square root of the product of sizes
    return intersection_size / math.sqrt(query_size * target_size)


def containment(intersection_size, query_size):
    # intersection size divided by the size of the query set
    return intersection_size / query_size


def containment_min(intersection_size, query_size, target_size):
    # intersection size divided by the minimal size of the query set and target set
    return intersection_size / min(query_size, target_size)


def containment_max(intersection_size, query_size, target_size):
    # intersection size divided by the maximal size of the query set and target set
    return intersection_size / max(query_size, target_size)


def init_pool(local_column_sets):
    global column_sets
    column_sets = local_column_sets


if __name__ == "__main__":
    freeze_support()
    with open(CONFIG_PATH) as f:
        config = json.load(f)

    mongo_client = pymongo.MongoClient(config["mongodb"]["uri"])
    db = mongo_client[config["mongodb"]["db"]]
    setoverlapresults_collection = db["setoverlapresults"]
    inferredstats_collection = db["inferredstats"]
    inferredcolumnstats_collection = db["inferredcolumnstats"]
    metadata_collection = db["metadata"]

    print("Finding candidate columns...")
    cols = list(inferredcolumnstats_collection.find({
        "is_all_null": False,
        "unique_values_count": {"$gte": MIN_UNIQUE_VALUE},
        "uniqueness_score": {"$gte": MIN_UNIQUENESS_SCORE},
    }))
    print("Found", len(cols), "candidate columns")

    print("Finding metadata for candidate columns...")
    metadata_dict = {}
    for c in tqdm(cols):
        if c['uuid'] not in metadata_dict:
            metadata_dict[c['uuid']] = metadata_collection.find_one(
                {"resources.id": c['uuid']})
    print("Finding candidate pairs...")

    candidate_pairs = []
    for c in tqdm(cols):
        for r in metadata_dict[c['uuid']]['resources']:
            if r['id'] == c['uuid']:
                continue
            if r['format'].lower() != 'csv':
                continue
            candidate_cols = inferredcolumnstats_collection.find({
                "uuid": r["id"],
                "is_all_null": False,
                "unique_values_count": {"$gte": MIN_UNIQUE_VALUE}
            })
            for cc in candidate_cols:
                candidate_pairs.append({
                    "source": {
                        "uuid": c["uuid"],
                        "index": c["index"]
                    },
                    "target": {
                        "uuid": cc["uuid"],
                        "index": cc["index"]
                    }
                })
    print("Found", len(candidate_pairs), "candidate pairs")

    uuid_set = set()
    for cc in candidate_pairs:
        uuid_set.add(cc["source"]["uuid"])
        uuid_set.add(cc["target"]["uuid"])

    print("Finding inferred stats for candidate columns...")
    inferredstats_list = inferredstats_collection.find({
        "uuid": {"$in": list(uuid_set)}
    })

    inferredstats_dict = {}
    for i in inferredstats_list:
        inferredstats_dict[i["uuid"]] = i
    print("Found", len(inferredstats_dict), "inferred stats")
    mongo_client.close()

    paths = [get_path_from_uuid(u) for u in uuid_set]

    print("Reading files...")
    curr_column_sets = {}
    with Pool(processes=NUM_PROCESSES) as pool:
        func = partial(read_file, inferredstats_dict=inferredstats_dict)
        for data in tqdm(pool.imap_unordered(func, paths), total=len(paths)):
            if data is not None:
                curr_column_sets[data["uuid"]] = data["sets"]
            pass

    results = []
    print("Calculating set overlap...")
    if platform == "linux" or platform == "linux2":
        pool = Pool(processes=NUM_PROCESSES)
        global column_sets
        column_sets = curr_column_sets
    else:
        pool = Pool(processes=NUM_PROCESSES, initializer=init_pool,
                    initargs=(curr_column_sets,))

    for data in tqdm(pool.imap_unordered(get_stats, candidate_pairs), total=len(candidate_pairs)):
        if data is not None:
            results.append(data)
        pass

    pool.close()

    results_cols_set = set()

    print("Deduplicating results...")
    for r in tqdm(results):
        pair = r['pair']
        results_cols_set.add((pair['source']['uuid'], pair['source']['index']))
        results_cols_set.add((pair['target']['uuid'], pair['target']['index']))

    mongo_client = pymongo.MongoClient(config["mongodb"]["uri"])
    db = mongo_client[config["mongodb"]["db"]]
    inferredcolumnstats_collection = db["inferredcolumnstats"]

    col_stats_dict = {}
    for r in tqdm(results_cols_set):
        col = inferredcolumnstats_collection.find_one(
            {"uuid": r[0], "index": r[1]})
        if r[0] not in col_stats_dict:
            col_stats_dict[r[0]] = {}
        col_stats_dict[r[0]][r[1]] = col

    print("Calculating scores...")
    scores = []
    for r in tqdm(results):
        query = r['pair']['source']
        target = r['pair']['target']
        query_unique_count = col_stats_dict[query['uuid']
                                            ][query['index']]['unique_values_count']
        target_unique_count = col_stats_dict[target['uuid']
                                             ][target['index']]['unique_values_count']
        query_count = col_stats_dict[query['uuid']][query['index']]['count']
        target_count = col_stats_dict[target['uuid']][target['index']]['count']
        intersection_size = r['intersection_size']
        union_size = r['union_size']

        jaccard_score = jaccard(intersection_size, union_size)
        cosine_score = cosine(
            intersection_size, query_unique_count, target_unique_count)
        containment_score = containment(intersection_size, query_unique_count)
        containment_min_score = containment_min(
            intersection_size, query_unique_count, target_unique_count)
        containment_max_score = containment_max(
            intersection_size, query_unique_count, target_unique_count)
        scores.append({
            "query_uuid": query['uuid'],
            "query_index": query['index'],
            "target_uuid": target['uuid'],
            "target_index": target['index'],
            "query_unique_count": query_unique_count,
            "target_unique_count": target_unique_count,
            "query_count": query_count,
            "target_count": target_count,
            "intersection_size": intersection_size,
            "union_size": union_size,
            "jaccard_score": jaccard_score,
            "cosine_score": cosine_score,
            "containment_score": containment_score,
            "containment_min_score": containment_min_score,
            "containment_max_score": containment_max_score
        })

    print("Writing scores to database...")
    db["keyjoinscores"].insert_many(scores)

    mongo_client.close()
    print("Done.")
