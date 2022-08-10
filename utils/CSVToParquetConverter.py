import sys
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
import os
import json
import portalocker
import shutil

CACHE_DIR = os.path.abspath(os.path.join(os.path.dirname(
    os.path.abspath(__file__)), "..", "data/parquet_cache/"))

chunksize = 10000
file_path = sys.argv[1]
encoding = sys.argv[2]
header = int(sys.argv[3])
try:
    field_names = json.loads(sys.argv[4])
except:
    field_names = None
uuid = os.path.splitext(os.path.basename(file_path))[0]
parquet_file_name = "%s%s.parquet" % (
    uuid, "_num_index" if field_names is None else "")
parquet_path = os.path.join(CACHE_DIR, parquet_file_name)

lock = portalocker.RedisLock(parquet_path)
with lock:
    if os.path.exists(parquet_path) and os.path.getsize(parquet_path) > 0:
        with open(parquet_path, "rb") as f:
            shutil.copyfileobj(f, sys.stdout.buffer)
    else:
        csv_stream = pd.read_csv(file_path, encoding=encoding,
                                 chunksize=chunksize, on_bad_lines='skip',
                                 dtype=str, low_memory=False)
        for i, chunk in enumerate(csv_stream):
            chunk.fillna('', inplace=True)
            if field_names is not None and len(chunk.columns) == len(field_names):
                chunk.columns = field_names
            else:
                chunk.columns = [str(i) for i in range(len(chunk.columns))]
            if i == 0:
                parquet_schema = pa.Table.from_pandas(df=chunk).schema
                parquet_cache_writer = pq.ParquetWriter(
                    parquet_path, parquet_schema, compression='snappy')

            table = pa.Table.from_pandas(chunk, schema=parquet_schema)
            parquet_cache_writer.write_table(table)
        parquet_cache_writer.close()
        with open(parquet_path, "rb") as f:
            shutil.copyfileobj(f, sys.stdout.buffer)
