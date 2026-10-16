import { ParquetReader } from "parquets";

export const parseParquet = async (data: Buffer) => {
  const reader = await ParquetReader.openBuffer(data);

  const cursor = reader.getCursor();

  const records = [];

  let record = null;
  while ((record = await cursor.next())) {
    records.push(record);
  }

  return records;
};
