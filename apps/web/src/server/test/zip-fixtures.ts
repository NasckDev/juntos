import { deflateRawSync } from "node:zlib";

/*
 * ZIPs montados à mão para os testes da conferência de upload (bomba de descompressão, tamanhos que mentem).
 */

export interface FakeEntry {
  readonly name: string;
  readonly data: Uint8Array;
  readonly method?: 0 | 8 | 12;
  /** Tamanho descompactado declarado (para simular um ZIP que mente). */
  readonly declaredSize?: number;
  readonly flags?: number;
}

/** Monta um ZIP mínimo (sem CRC, que a conferência não usa) com cabeçalhos locais e diretório central. */
export function buildZip(entries: readonly FakeEntry[]): Uint8Array<ArrayBuffer> {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const method = entry.method ?? 8;
    const body = method === 8 ? deflateRawSync(entry.data) : Buffer.from(entry.data);
    const name = Buffer.from(entry.name, "utf8");
    const size = entry.declaredSize ?? entry.data.byteLength;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(entry.flags ?? 0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(body.byteLength, 18);
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(name.byteLength, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(entry.flags ?? 0, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(body.byteLength, 20);
    central.writeUInt32LE(size, 24);
    central.writeUInt16LE(name.byteLength, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, name, body);
    centrals.push(central, name);
    offset += local.byteLength + name.byteLength + body.byteLength;
  }
  const directory = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(directory.byteLength, 12);
  eocd.writeUInt32LE(offset, 16);
  const zip = Buffer.concat([...locals, directory, eocd]);
  return Uint8Array.from(zip);
}
