import sys
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

chunksize = 10000
file_path = sys.argv[1]
encoding = sys.argv[2]
header = int(sys.argv[3])


csv_stream = pd.read_csv(file_path, encoding=encoding, chunksize=chunksize, on_bad_lines='skip', dtype=str)
for i, chunk in enumerate(csv_stream):
    chunk.fillna('', inplace=True)
    if i == 0:
        parquet_schema = pa.Table.from_pandas(df=chunk).schema
        parquet_writer = pq.ParquetWriter(sys.stdout.buffer, parquet_schema, compression='snappy')

    table = pa.Table.from_pandas(chunk, schema=parquet_schema)
    parquet_writer.write_table(table)
parquet_writer.close()