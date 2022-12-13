import pymongo
import plotly.express as px
import sys
import numpy as np
import os
import json

uuid = sys.argv[1]
field = sys.argv[2]

CONFIG_PATH = os.path.abspath(os.path.join(os.path.dirname(
    os.path.abspath(__file__)), "..", "app.config.json"))

with open(CONFIG_PATH) as f:
    config = json.load(f)

UNAVAILABLE_HTML = os.path.abspath(os.path.join(os.path.dirname(
    os.path.abspath(__file__)), "..", "public/visualization-unavailable.html"))


def get_histogram(uuid, field):
    mongo_client = pymongo.MongoClient(config["mongodb"]["uri"])
    db = mongo_client[config["mongodb"]["db"]]
    inferred_collection = db.inferredhistograms
    found = inferred_collection.find_one(
        {"uuid": uuid})
    mongo_client.close()
    if found is None:
        return
    if field not in found['histograms']:
        return
    return found['histograms'][field]


histogram_data = get_histogram(uuid, field)
fig = None
if histogram_data is not None:
    if "hist" in histogram_data and "bins" in histogram_data:
        fig = px.bar(x=histogram_data["bins"], y=histogram_data["hist"], labels={
            "x": field, "y": "count"})

    if "hist" in histogram_data and "bin_edges" in histogram_data:
        counts = np.array(histogram_data["hist"])
        bins = np.array(histogram_data["bin_edges"])
        df = px.data.tips()
        bins = 0.5 * (bins[:-1] + bins[1:])
        fig = px.bar(x=bins, y=counts, labels={'x': field, 'y': 'count'})

if fig:
    fig.write_html(sys.stdout, include_plotlyjs="cdn")
    sys.stdout.flush()
else:
    f = open(UNAVAILABLE_HTML, 'r')
    html = f.read()
    print(html)
    f.close()
