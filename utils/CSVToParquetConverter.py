import sys
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
import os
import json

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

csv_stream = pd.read_csv(file_path, encoding=encoding,
                         chunksize=chunksize, on_bad_lines='skip', dtype=str)
for i, chunk in enumerate(csv_stream):
    chunk.fillna('', inplace=True)
    if field_names is not None and len(chunk.columns) == len(field_names):
        chunk.columns = field_names
    else:
        chunk.columns = [str(i) for i in range(len(chunk.columns))]
    if i == 0:
        cache_file_name = "%s%s.parquet" % (
            uuid, "_num_index" if field_names is None else "")
        parquet_schema = pa.Table.from_pandas(df=chunk).schema
        parquet_writer = pq.ParquetWriter(
            sys.stdout.buffer, parquet_schema, compression='snappy')
        parquet_cache_writer = pq.ParquetWriter(
            os.path.join(CACHE_DIR, cache_file_name), parquet_schema, compression='snappy')

    table = pa.Table.from_pandas(chunk, schema=parquet_schema)
    parquet_writer.write_table(table)
    parquet_cache_writer.write_table(table)
parquet_writer.close()
